import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { canAccessVisit } from './_shared/visit-access';
import { getVisit } from './_shared/visits';

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const visitId = context.params.id as string | undefined;
  if (!visitId) {
    return json({ error: 'ID da visita é obrigatório' }, 400);
  }

  const visit = await getVisit(visitId);
  if (!visit || !canAccessVisit(visit, auth)) {
    return json({ error: 'Visita não encontrada' }, 404);
  }

  return json({
    visitId: visit.visitId,
    syncStatus: visit.syncStatus,
    syncError: visit.syncError || null,
    progress: visit.payload?.driveSync ? {
      sent: Object.keys(visit.payload.driveSync.photos || {}).length,
      total: Number(visit.payload.driveSync.totalPhotos || 0),
    } : undefined,
    updatedAt: visit.updatedAt,
  });
};

export const config: Config = {
  path: '/api/sync/:id/status',
};
