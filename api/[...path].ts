import health from '../netlify/functions/health';
import config from '../netlify/functions/config';
import authLogin from '../netlify/functions/auth-login';
import stores from '../netlify/functions/stores';
import visits from '../netlify/functions/visits';
import visitUpdate from '../netlify/functions/visit-update';
import visitSync from '../netlify/functions/visit-sync';
import syncStatus from '../netlify/functions/sync-status';
import retrySync from '../netlify/functions/retry-sync';
import syncQueue from '../netlify/functions/sync-queue';
import supervisorDashboard from '../netlify/functions/supervisor-dashboard';
import supervisorPromoters from '../netlify/functions/supervisor-promoters';
import aiAnalyze from '../netlify/functions/ai-analyze';

type Handler = (request: Request, context: { params: Record<string, string> }) => Promise<Response>;

type RouteMatch = {
  method?: string[];
  pattern: RegExp;
  handler: Handler;
  params?: (pathname: string) => Record<string, string>;
};

const createRequest = async (req: any) => {
  const protocol = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.host || 'localhost';
  const url = new URL(req.url || '/', `${protocol}://${host}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers || {})) {
    if (typeof value === 'string') {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    }
  }

  const method = String(req.method || 'GET').toUpperCase();
  let body: BodyInit | undefined;

  if (!['GET', 'HEAD'].includes(method)) {
    if (typeof req.body === 'string' || req.body instanceof Uint8Array) {
      body = req.body;
    } else if (req.body !== undefined) {
      body = JSON.stringify(req.body);
    }
  }

  return new Request(url, { method, headers, body });
};

const routes: RouteMatch[] = [
  { method: ['GET'], pattern: /^\/api\/health$/, handler: health },
  { method: ['GET', 'POST'], pattern: /^\/api\/config$/, handler: config },
  { method: ['POST'], pattern: /^\/api\/auth\/login$/, handler: authLogin },
  { method: ['GET'], pattern: /^\/api\/stores$/, handler: stores },
  { method: ['GET', 'POST'], pattern: /^\/api\/visits$/, handler: visits },
  { method: ['POST'], pattern: /^\/api\/visits\/sync$/, handler: visitSync },
  {
    method: ['PATCH'],
    pattern: /^\/api\/visits\/([^/]+)$/,
    handler: visitUpdate,
    params: (pathname) => ({ id: pathname.split('/').pop() || '' }),
  },
  {
    method: ['GET'],
    pattern: /^\/api\/sync\/([^/]+)\/status$/,
    handler: syncStatus,
    params: (pathname) => ({ id: pathname.split('/')[3] || '' }),
  },
  {
    method: ['POST'],
    pattern: /^\/api\/sync\/([^/]+)\/retry$/,
    handler: retrySync,
    params: (pathname) => ({ id: pathname.split('/')[3] || '' }),
  },
  { method: ['GET'], pattern: /^\/api\/sync\/queue$/, handler: syncQueue },
  { method: ['GET'], pattern: /^\/api\/supervisor\/dashboard$/, handler: supervisorDashboard },
  {
    method: ['GET'],
    pattern: /^\/api\/supervisor\/promoters\/([^/]+)$/,
    handler: supervisorPromoters,
    params: (pathname) => ({ id: pathname.split('/').pop() || '' }),
  },
  { method: ['POST'], pattern: /^\/api\/ai\/analyze$/, handler: aiAnalyze },
];

export default async function handler(req: any, res: any) {
  const request = await createRequest(req);
  const pathname = new URL(request.url).pathname;
  const method = request.method.toUpperCase();

  const match = routes.find((route) => route.pattern.test(pathname) && (!route.method || route.method.includes(method)));
  if (!match) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Rota não encontrada' }));
    return;
  }

  const context = { params: match.params?.(pathname) || {} };
  const response = await match.handler(request, context);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
