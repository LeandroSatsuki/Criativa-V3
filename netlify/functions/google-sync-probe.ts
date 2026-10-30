import { timingSafeEqual } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import { getEnv } from './_shared/env';
import { requestGoogle } from './_shared/google-sync';
import { json } from './_shared/json';

const HOMOLOGATION_JOB_ID = 'homolog-ingress-batch-b';

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export default async (request: Request, _context: Context) => {
  if ((getEnv('BACKEND_GOOGLE_SYNC_PROBE_ENABLED') || '').toLowerCase() !== 'true') {
    return json({ error: 'Not found' }, 404);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expectedToken = getEnv('BACKEND_GOOGLE_SYNC_PROBE_TOKEN');
  const receivedToken = request.headers.get('x-probe-token') || '';
  if (!expectedToken || !receivedToken || !safeEqual(expectedToken, receivedToken)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const status = await requestGoogle(`/v1/ingress/jobs/${HOMOLOGATION_JOB_ID}`);
    const receipts = Array.isArray(status.receipt) ? status.receipt : [];
    return json({
      ok: status.state === 'completed' && receipts.length === 2,
      state: status.state,
      receiptCount: receipts.length,
    }, status.state === 'completed' && receipts.length === 2 ? 200 : 502);
  } catch (error: any) {
    return json({
      ok: false,
      reason: error?.name === 'AbortError' ? 'timeout' : 'google_sync_unavailable',
    }, 502);
  }
};

export const config: Config = {
  path: '/api/internal/google-sync-probe',
  method: ['POST'],
};
