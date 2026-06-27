import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { getVisit } from './_shared/visits';

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const visitId = context.params.id as string | undefined;
  if (!visitId) {
    return json({ error: 'ID da visita é obrigatório' }, 400);
  }

  const visit = await getVisit(visitId);
  if (!visit) {
    return json({ error: 'Visita não encontrada' }, 404);
  }

  return json({
    visitId: visit.visitId,
    syncStatus: visit.syncStatus,
    syncError: visit.syncError || null,
    updatedAt: visit.updatedAt,
  });
};

export const config: Config = {
  path: '/api/sync/:id/status',
};
