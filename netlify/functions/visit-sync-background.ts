import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { getEnv } from './_shared/env';
import { getBackgroundPollDelayMs } from './_shared/sync-provider';
import { canAccessVisit } from './_shared/visit-access';
import { getVisit } from './_shared/visits';
import { syncVisitRecord } from './_shared/sync';

const MAX_BACKGROUND_RUNS = 100;

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') return;

  const auth = await authenticate(request);
  const visitId = context.params.id as string | undefined;
  if (!auth || !visitId) return;
  const pollDelayMs = getBackgroundPollDelayMs(getEnv('BACKEND_SYNC_PROVIDER'));

  for (let attempt = 0; attempt < MAX_BACKGROUND_RUNS; attempt += 1) {
    const visit = await getVisit(visitId);
    if (!visit || !canAccessVisit(visit, auth) || visit.syncStatus === 'enviado') return;

    const result = await syncVisitRecord(visit);
    if (result.syncStatus !== 'enviando') return;
    if (pollDelayMs) await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
  }
};

export const config: Config = {
  path: '/api/sync/:id/background',
  method: ['POST'],
};
