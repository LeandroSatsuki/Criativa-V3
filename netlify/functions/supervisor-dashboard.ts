import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { getAppData } from './_shared/data';
import { listVisits } from './_shared/visits';
import { buildSupervisorDashboard } from './_shared/supervisor';

export default async (request: Request, _context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
  if (!auth || auth.role !== 'SUPERVISOR') {
    return json({ error: 'Acesso restrito ao supervisor' }, 403);
  }

  const [data, visits] = await Promise.all([getAppData(), listVisits()]);
  return json(buildSupervisorDashboard(data, visits));
};

export const config: Config = {
  path: '/api/supervisor/dashboard',
};
