import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { getAppData, refreshAppData } from './_shared/data';
import { authenticate } from './_shared/auth';

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === 'true';
  const auth = await authenticate(request);

  if (force) {
    if (!auth) {
      return json({ error: 'Não autorizado' }, 401);
    }

    const fresh = await refreshAppData();
    return json({
      industries: fresh.industries,
      timestamp: fresh.timestamp,
    });
  }

  const data = await getAppData();
  return json({
    industries: data.industries,
    timestamp: data.timestamp,
  });
};

export const config: Config = {
  path: '/api/config',
};
