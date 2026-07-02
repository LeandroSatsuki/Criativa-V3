import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { getVisit, upsertVisit } from './_shared/visits';
import { syncVisitRecord } from './_shared/sync';

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
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
  const result = await syncVisitRecord(visit);
  const status = result.syncStatus === 'enviado' ? 200 : result.syncStatus === 'enviando' ? 202 : result.syncStatus === 'erro' ? 502 : 200;
  return json(result, status);
};

export const config: Config = {
  path: '/api/visits/sync',
  method: ['POST'],
};
