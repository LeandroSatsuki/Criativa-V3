import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { getEnv } from './_shared/env';
import { getAppData } from './_shared/data';
import { json } from './_shared/json';
import { buildOperationsHealth } from './_shared/operations-health';
import { getSupervisorAccessError } from './_shared/supervisor-access';
import { listVisitSummaries } from './_shared/visits';

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
  const accessError = getSupervisorAccessError(auth);
  if (accessError) {
    return json({ error: accessError.message }, accessError.status);
  }

  try {
    const [data, visits] = await Promise.all([getAppData(), listVisitSummaries()]);
    return json(buildOperationsHealth(data, visits, getEnv('BACKEND_MIN_STORE_COUNT')));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'operations_health_failed',
      requestId: context.requestId,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
    return json({ error: 'Diagnostico operacional temporariamente indisponivel.' }, 503);
  }
};

export const config: Config = {
  path: '/api/supervisor/operations-health',
};
