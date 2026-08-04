import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { getAppData } from './_shared/data';
import { listVisits } from './_shared/visits';
import { buildSupervisorDashboard } from './_shared/supervisor';
import { getSupervisorAccessError } from './_shared/supervisor-access';

export default async (request: Request, _context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
  const accessError = getSupervisorAccessError(auth);
  if (accessError) {
    return json({ error: accessError.message }, accessError.status);
  }

  const [data, visits] = await Promise.all([getAppData(), listVisits()]);
  return json(buildSupervisorDashboard(data, visits));
};

export const config: Config = {
  path: '/api/supervisor/dashboard',
};
