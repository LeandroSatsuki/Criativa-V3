import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { canAccessVisit } from './_shared/visit-access';
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
  if (existing && !canAccessVisit(existing, auth)) {
    return json({ error: 'Visita não encontrada' }, 404);
  }

  const visit = existing || await upsertVisit({
    ...payload,
    visitId: resolvedVisitId,
    user: {
      id: auth.sub,
      name: auth.name,
      role: auth.role,
      region: auth.region,
      user: auth.user,
    },
  });
  const result = await syncVisitRecord(visit);
  const status = result.syncStatus === 'enviando' ? 202 : 200;
  return json(result, status);
};

export const config: Config = {
  path: '/api/visits/sync',
  method: ['POST'],
};
