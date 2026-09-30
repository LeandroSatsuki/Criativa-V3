import { timingSafeEqual } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import { getEnv } from './_shared/env';
import { json } from './_shared/json';
import {
  MAKE_CONTRACT_VERSION,
  validatePhotoBatchUploadResponse,
  type MakePhotoBatchEvent,
} from './_shared/make-contract-v2';
import { postMakeEvent } from './_shared/make-sync-v2';

const TIMEOUT_PROBE_MS = 1000;
const RETRY_PROBE_MS = 45000;

const SYNTHETIC_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const isProbeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9-]{12,64}$/.test(value);

const buildProbeBatch = (probeId: string): MakePhotoBatchEvent => {
  const batchId = `preview-timeout:${probeId}`;
  const photos = [1, 2].map((order) => ({
    EVENT_ID: `${batchId}:photo:${order}`,
    IDEMPOTENCY_KEY: `${batchId}:photo:${order}`,
    ID_FOTO: `${probeId}-photo-${order}`,
    ETAPA: order === 1 ? 'ANTES' as const : 'DEPOIS' as const,
    INDUSTRIA: 'HOMOLOGACAO_LOTE',
    ORDEM: order,
    NOME_ARQUIVO: `NETLIFY_TIMEOUT_${probeId}_${order}.jpg`,
    MIME_TYPE: 'image/jpeg' as const,
    TAMANHO_BYTES: 68,
    FOTO_BASE64: SYNTHETIC_IMAGE_BASE64,
  }));

  return {
    CONTRACT_VERSION: MAKE_CONTRACT_VERSION,
    EVENT_TYPE: 'PHOTO_UPLOAD_BATCH',
    EVENT_ID: batchId,
    BATCH_ID: batchId,
    ID_VISITA: `visit-${probeId}`,
    PASTA_INDUSTRIA_NOME: 'HOMOLOGACAO_LOTE',
    PASTA_VISITA_NOME: '18-08-2026',
    PASTA_PDV_NOME: 'PDV TESTE LOTE 20',
    PASTA_SUBPASTA_NOME: '',
    LAYOUT_PASTAS: 'INDUSTRIA_DATA_PDV_V1',
    NOME_LOJA: 'PDV TESTE LOTE 20',
    NOME_PROMOTOR: 'HOMOLOGACAO CODEX',
    ROW_WRITE: false,
    TOTAL_FOTOS: photos.length,
    PHOTOS: photos,
  };
};

export default async (request: Request, _context: Context) => {
  const enabledValue = getEnv('BACKEND_MAKE_TIMEOUT_PROBE_RUNTIME_ENABLED')
    || getEnv('BACKEND_MAKE_TIMEOUT_PROBE_ENABLED')
    || '';
  const enabled = enabledValue.toLowerCase() === 'true';
  if (!enabled) {
    return json({ error: 'Not found' }, 404);
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const expectedToken = getEnv('BACKEND_MAKE_TIMEOUT_PROBE_RUNTIME_TOKEN')
    || getEnv('BACKEND_MAKE_TIMEOUT_PROBE_TOKEN')
    || '';
  const receivedToken = request.headers.get('x-probe-token') || '';
  if (!expectedToken || !receivedToken || !safeEqual(expectedToken, receivedToken)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const payload = await request.json().catch(() => ({}));
  if (!isProbeId(payload?.probeId) || !['timeout', 'retry'].includes(payload?.mode)) {
    return json({ error: 'Invalid probe request' }, 400);
  }

  const webhookUrl = getEnv('BACKEND_MAKE_TIMEOUT_PROBE_WEBHOOK_URL')
    || getEnv('BACKEND_MAKE_WEBHOOK_V2_URL')
    || '';
  if (!webhookUrl.startsWith('https://hook.us2.make.com/')) {
    return json({ error: 'Homologation webhook unavailable' }, 503);
  }

  const batch = buildProbeBatch(payload.probeId);
  const timeoutMs = payload.mode === 'timeout' ? TIMEOUT_PROBE_MS : RETRY_PROBE_MS;
  try {
    const responseBody = await postMakeEvent(webhookUrl, batch, timeoutMs);
    const receipts = validatePhotoBatchUploadResponse(responseBody, batch);
    return json({
      ok: true,
      reason: 'completed',
      timeoutMs,
      batchId: batch.BATCH_ID,
      receipts: receipts.map((receipt) => ({
        photoId: receipt.photoId,
        fileId: receipt.fileId,
        folderId: receipt.folderId,
        pdvFolderId: receipt.pdvFolderId,
      })),
    });
  } catch (error: any) {
    const timeout = error?.name === 'AbortError';
    return json({
      ok: false,
      reason: timeout ? 'timeout' : 'make_event_failed',
      timeoutMs,
      batchId: batch.BATCH_ID,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }, timeout ? 504 : 502);
  }
};

export const config: Config = {
  path: '/api/internal/make-timeout-probe',
  method: ['POST'],
};
