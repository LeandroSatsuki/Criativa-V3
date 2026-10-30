import express from 'express';
import { pathToFileURL } from 'node:url';
import { Firestore } from '@google-cloud/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { DriveWriter } from './drive.js';
import {
  createAuthorizedGoogleClients,
  createCloudAuth,
  createOAuthClient,
  FirestoreOAuthStateStore,
  GcsPhotoStore,
  GoogleSecretWriter,
} from './google-runtime.js';
import { FirestoreJobRepository } from './jobs.js';
import { SyncIngress } from './ingress.js';
import {
  bearerMatches,
  buildAuthorizationUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeAndStoreRefreshToken,
  type OAuthStateStore,
  type SecretVersionWriter,
} from './oauth.js';
import { SheetsWriter } from './sheets.js';
import { SyncWorker } from './worker.js';
import { GoogleCloudTaskPublisher } from './tasks.js';
import type { PhotoBatchIngress, PhotoBatchJob, VisitFinalizeJob } from './contracts.js';

type ServiceRole = 'health' | 'oauth-bootstrap' | 'ingress' | 'worker';

type OAuthDependencies = {
  client: ReturnType<typeof createOAuthClient>;
  stateStore: OAuthStateStore;
  secretWriter: SecretVersionWriter;
  stateSecret: string;
  bootstrapSecret: string;
  refreshTokenSecretName: string;
};

type AppOptions = {
  role?: ServiceRole;
  oauth?: OAuthDependencies;
  ingress?: SyncIngress;
  ingressSecret?: string;
  worker?: SyncWorker;
};

export const createApp = (options: AppOptions = {}) => {
  const role = options.role || 'health';
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: role === 'ingress' ? '32mb' : '1mb' }));

  app.get('/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'criativa-google-sync',
      mode: 'homologation',
      role,
      acceptsTraffic: role === 'ingress' || role === 'worker',
      makeCalled: false,
    });
  });

  if (role === 'oauth-bootstrap' && options.oauth) {
    app.get('/oauth/start', async (request, response, next) => {
      try {
        if (!bearerMatches(request.header('authorization'), options.oauth!.bootstrapSecret)) {
          response.status(401).json({ ok: false, error: 'unauthorized' });
          return;
        }
        const state = await createOAuthState(options.oauth!.stateSecret, options.oauth!.stateStore);
        response.json({ authorizationUrl: buildAuthorizationUrl(options.oauth!.client, state) });
      } catch (error) {
        next(error);
      }
    });

    app.get('/oauth/callback', async (request, response, next) => {
      try {
        const state = String(request.query.state || '');
        const code = String(request.query.code || '');
        const valid = code && await consumeOAuthState(
          state,
          options.oauth!.stateSecret,
          options.oauth!.stateStore,
        );
        if (!valid) {
          response.status(400).send('Autorizacao invalida ou expirada.');
          return;
        }
        await exchangeAndStoreRefreshToken(
          options.oauth!.client,
          code,
          options.oauth!.secretWriter,
          options.oauth!.refreshTokenSecretName,
        );
        response.type('text/plain').send('Autorizacao concluida. Esta janela pode ser fechada.');
      } catch (error) {
        next(error);
      }
    });
  }

  if (role === 'worker' && options.worker) {
    app.post('/v1/worker/photo-batch', async (request, response, next) => {
      try {
        const receipts = await options.worker!.processPhotoBatch(request.body as PhotoBatchJob);
        response.json({ ok: true, receipts });
      } catch (error) {
        next(error);
      }
    });
    app.post('/v1/worker/finalize', async (request, response, next) => {
      try {
        const receipt = await options.worker!.finalizeVisit(request.body as VisitFinalizeJob);
        response.json({ ok: true, ...receipt });
      } catch (error) {
        next(error);
      }
    });
  }

  if (role === 'ingress' && options.ingress && options.ingressSecret) {
    const authorized = (request: express.Request) => {
      const ingressToken = request.header('x-ingress-token');
      return bearerMatches(ingressToken ? `Bearer ${ingressToken}` : undefined, options.ingressSecret!);
    };
    app.post('/v1/ingress/photo-batch', async (request, response, next) => {
      try {
        if (!authorized(request)) {
          response.status(401).json({ ok: false, error: 'unauthorized' });
          return;
        }
        const result = await options.ingress!.acceptPhotoBatch(request.body as PhotoBatchIngress);
        response.status(result.state === 'completed' ? 200 : 202).json({ ok: true, ...result });
      } catch (error) {
        next(error);
      }
    });
    app.post('/v1/ingress/finalize', async (request, response, next) => {
      try {
        if (!authorized(request)) {
          response.status(401).json({ ok: false, error: 'unauthorized' });
          return;
        }
        const result = await options.ingress!.acceptFinalize(request.body as VisitFinalizeJob);
        response.status(result.state === 'completed' ? 200 : 202).json({ ok: true, ...result });
      } catch (error) {
        next(error);
      }
    });
    app.get('/v1/ingress/jobs/:id', async (request, response, next) => {
      try {
        if (!authorized(request)) {
          response.status(401).json({ ok: false, error: 'unauthorized' });
          return;
        }
        const result = await options.ingress!.getStatus(String(request.params.id || ''));
        response.json({ ok: true, ...result });
      } catch (error) {
        next(error);
      }
    });
  }

  app.use((_request, response) => {
    response.status(404).json({ ok: false, error: 'not_found' });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(JSON.stringify({
      event: 'request_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
    response.status(500).json({ ok: false, error: 'internal_error' });
  });

  return app;
};

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return value;
};

const createRuntimeApp = () => {
  const role = (process.env.SERVICE_ROLE || 'health') as ServiceRole;
  if (role === 'health') return createApp({ role });
  const firestore = new Firestore();

  if (role === 'oauth-bootstrap') {
    return createApp({
      role,
      oauth: {
        client: createOAuthClient(
          required('GOOGLE_OAUTH_CLIENT_ID'),
          required('GOOGLE_OAUTH_CLIENT_SECRET'),
          required('GOOGLE_OAUTH_REDIRECT_URI'),
        ),
        stateStore: new FirestoreOAuthStateStore(firestore),
        secretWriter: new GoogleSecretWriter(new SecretManagerServiceClient()),
        stateSecret: required('OAUTH_STATE_SECRET'),
        bootstrapSecret: required('OAUTH_BOOTSTRAP_SECRET'),
        refreshTokenSecretName: required('GOOGLE_REFRESH_TOKEN_SECRET_NAME'),
      },
    });
  }

  if (role === 'worker') {
    const clients = createAuthorizedGoogleClients(
      required('GOOGLE_OAUTH_CLIENT_ID'),
      required('GOOGLE_OAUTH_CLIENT_SECRET'),
      required('GOOGLE_OAUTH_REFRESH_TOKEN'),
    );
    return createApp({
      role,
      worker: new SyncWorker(
        new FirestoreJobRepository(firestore),
        new GcsPhotoStore(createCloudAuth(), required('GOOGLE_STAGING_BUCKET')),
        new DriveWriter(clients.drive, required('GOOGLE_DRIVE_ROOT_FOLDER_ID')),
        new SheetsWriter(clients.sheets, required('GOOGLE_SHEETS_ID'), required('GOOGLE_SHEETS_TAB')),
      ),
    });
  }


  if (role === 'ingress') {
    const cloudAuth = createCloudAuth();
    const jobs = new FirestoreJobRepository(firestore);
    const objects = new GcsPhotoStore(cloudAuth, required('GOOGLE_STAGING_BUCKET'));
    return createApp({
      role,
      ingressSecret: required('INGRESS_SECRET'),
      ingress: new SyncIngress(
        jobs,
        objects,
        new GoogleCloudTaskPublisher(
          cloudAuth,
          required('GOOGLE_CLOUD_PROJECT'),
          required('GOOGLE_TASKS_LOCATION'),
          required('GOOGLE_TASKS_QUEUE'),
          required('GOOGLE_WORKER_URL'),
          required('GOOGLE_TASKS_SERVICE_ACCOUNT'),
        ),
      ),
    });
  }

  throw new Error(`SERVICE_ROLE invalido: ${role}`);
};

const isEntrypoint = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const port = Number(process.env.PORT || 8080);
  createRuntimeApp().listen(port, '0.0.0.0', () => {
    console.log(JSON.stringify({
      event: 'service_started',
      service: 'criativa-google-sync',
      mode: 'homologation',
      role: process.env.SERVICE_ROLE || 'health',
      port,
    }));
  });
}
