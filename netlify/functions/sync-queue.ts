import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { getAppData } from './_shared/data';
import { listVisits } from './_shared/visits';

export default async (request: Request, _context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const visits = await listVisits();
  const data = await getAppData();
  const isSupervisor = auth.role === 'SUPERVISOR';

  const queue = visits
    .filter((visit) => ['pendente', 'erro', 'reenviar', 'enviando'].includes(visit.syncStatus))
    .filter((visit) => {
      if (isSupervisor) return true;
      const ownerId = String(visit.payload?.user?.id || '');
      return ownerId === auth.sub;
    })
    .map((visit) => ({
      visitId: visit.visitId,
      syncStatus: visit.syncStatus,
      syncError: visit.syncError || null,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      store: visit.payload?.currentStore || '',
      promoter: visit.payload?.user?.name || auth.name,
      region: visit.payload?.user?.region || auth.region || '',
    }));

  return json({
    count: queue.length,
    queue,
    industries: data.industries,
  });
};

export const config: Config = {
  path: '/api/sync/queue',
};
