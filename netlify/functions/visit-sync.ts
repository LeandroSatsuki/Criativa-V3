import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { buildTransformedPayload, getVisit, saveVisit, upsertVisit } from './_shared/visits';
import { getEnv } from './_shared/env';

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const visitId = context.params.id as string | undefined;
  const payload = await request.json().catch(() => ({}));
  const resolvedVisitId = visitId || payload.visitId;

  if (!resolvedVisitId) {
    return json({ error: 'ID da visita é obrigatório' }, 400);
  }

  const existing = await getVisit(resolvedVisitId);
  const visit = existing || await upsertVisit({ ...payload, visitId: resolvedVisitId });
  const transformedPayload = buildTransformedPayload(visit.payload);
  const webhookUrl = getEnv('BACKEND_MAKE_WEBHOOK_URL');

  if (!webhookUrl) {
    const errored = await saveVisit({
      ...visit,
      syncStatus: 'erro',
      syncError: 'BACKEND_MAKE_WEBHOOK_URL não configurada.',
      updatedAt: new Date().toISOString(),
    });

    return json({
      visitId: errored.visitId,
      syncStatus: errored.syncStatus,
      syncError: errored.syncError,
    }, 503);
  }

  const sending = await saveVisit({
    ...visit,
    syncStatus: 'enviando',
    syncError: null,
    updatedAt: new Date().toISOString(),
  });

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transformedPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errored = await saveVisit({
        ...sending,
        syncStatus: 'erro',
        syncError: errorText || response.statusText,
        makeResponse: { status: response.status, ok: false },
        updatedAt: new Date().toISOString(),
      });

      return json({
        visitId: errored.visitId,
        syncStatus: errored.syncStatus,
        syncError: errored.syncError,
      }, 502);
    }

    const sent = await saveVisit({
      ...sending,
      syncStatus: 'enviado',
      syncError: null,
      makeResponse: { status: response.status, ok: true },
      updatedAt: new Date().toISOString(),
    });

    return json({
      visitId: sent.visitId,
      syncStatus: sent.syncStatus,
      syncError: sent.syncError || null,
    });
  } catch (error: any) {
    const errored = await saveVisit({
      ...sending,
      syncStatus: 'erro',
      syncError: error.message || 'Falha na sincronização',
      updatedAt: new Date().toISOString(),
    });

    return json({
      visitId: errored.visitId,
      syncStatus: errored.syncStatus,
      syncError: errored.syncError,
    }, 500);
  }
};

export const config: Config = {
  path: '/api/visits/sync',
  method: ['POST'],
};
