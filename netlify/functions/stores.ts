import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { getAppData, getStoresForUser } from './_shared/data';

export default async (request: Request, _context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get('userId');
  const data = await getAppData();
  const user = {
    id: requestedUserId || auth.sub,
    name: auth.name,
    role: auth.role,
    region: auth.region,
    storeResponsible: auth.storeResponsible,
    user: auth.user,
  };

  return json(getStoresForUser(data, user));
};

export const config: Config = {
  path: '/api/stores',
};
