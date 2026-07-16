import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { generateVisitId, listVisits, saveVisit, upsertVisit } from './_shared/visits';

export default async (request: Request, _context: Context) => {
  const auth = await authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  if (request.method === 'GET') {
    return json(await listVisits());
  }

  if (request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    const record = await upsertVisit({
      ...payload,
      visitId: payload?.visitId || generateVisitId(),
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
