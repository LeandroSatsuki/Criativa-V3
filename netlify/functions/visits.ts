import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { canAccessVisit } from './_shared/visit-access';
import { generateVisitId, getVisit, listVisits, saveVisit, upsertVisit } from './_shared/visits';

export default async (request: Request, _context: Context) => {
  const auth = await authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  if (request.method === 'GET') {
    const visits = await listVisits();
    return json(auth.role === 'SUPERVISOR'
      ? visits
      : visits.filter((visit) => canAccessVisit(visit, auth)));
  }

  if (request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    const visitId = payload?.visitId || generateVisitId();
    const existing = await getVisit(visitId);
    if (existing && !canAccessVisit(existing, auth)) {
      return json({ error: 'Visita não encontrada' }, 404);
    }

    const record = await upsertVisit({
      ...payload,
      visitId,
      user: {
        id: auth.sub,
        name: auth.name,
        role: auth.role,
        region: auth.region,
        user: auth.user,
      },
    });

    return json({
      visitId: record.visitId,
      syncStatus: record.syncStatus,
      updatedAt: record.updatedAt,
    }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config: Config = {
  path: '/api/visits',
};
