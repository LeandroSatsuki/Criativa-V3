import type { Config, Context } from '@netlify/functions';
import { createHash } from 'node:crypto';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { getJsonStore } from './_shared/storage';
import { generateVisitId, upsertVisit } from './_shared/visits';
import { getUtf8ByteLength, VISIT_PAYLOAD_CHUNK_MAX_BYTES } from '../../src/services/visitPayload';

type UploadRequest = {
  action?: 'chunk' | 'finalize';
  uploadId?: string;
  visitId?: string;
  index?: number;
  total?: number;
  chunk?: string;
};

type StoredChunk = {
  value: string;
  createdAt: string;
};

const MAX_CHUNKS = 48;
const MAX_VISIT_PAYLOAD_BYTES = 64 * 1024 * 1024;
const uploadStore = getJsonStore('criativa-visit-uploads');
const validIdentifier = /^[A-Za-z0-9_-]{6,128}$/;

const chunkKey = (userId: string, uploadId: string, index: number) =>
  `uploads/${userId}/${uploadId}/${String(index).padStart(3, '0')}`;

const validateEnvelope = (body: UploadRequest) => {
  const uploadId = String(body.uploadId || '');
  const visitId = String(body.visitId || '');
  const total = Number(body.total);

  if (!validIdentifier.test(uploadId) || !validIdentifier.test(visitId)) {
    return 'Identificador de upload ou visita inválido.';
  }
  if (!Number.isInteger(total) || total < 1 || total > MAX_CHUNKS) {
    return `Quantidade de fragmentos inválida. Máximo permitido: ${MAX_CHUNKS}.`;
  }
  return null;
};

const removeUploadChunks = async (userId: string, uploadId: string, total: number) => {
  await Promise.allSettled(
    Array.from({ length: total }, (_, index) => uploadStore.remove(chunkKey(userId, uploadId, index))),
  );
};

export default async (request: Request, _context: Context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const body = await request.json().catch(() => null) as UploadRequest | null;
  if (!body) {
    return json({ error: 'Payload de upload inválido.' }, 400);
  }

  const envelopeError = validateEnvelope(body);
  if (envelopeError) {
    return json({ error: envelopeError }, 400);
  }

  const uploadId = body.uploadId as string;
  const visitId = body.visitId as string;
  const total = body.total as number;

  if (body.action === 'chunk') {
    const index = Number(body.index);
    const chunk = typeof body.chunk === 'string' ? body.chunk : '';

    if (!Number.isInteger(index) || index < 0 || index >= total) {
      return json({ error: 'Índice de fragmento inválido.' }, 400);
    }
    if (!chunk || getUtf8ByteLength(chunk) > VISIT_PAYLOAD_CHUNK_MAX_BYTES) {
      return json({ error: 'Fragmento vazio ou acima do limite permitido.' }, 413);
    }

    await uploadStore.set(chunkKey(auth.sub, uploadId, index), {
      value: chunk,
      createdAt: new Date().toISOString(),
    } satisfies StoredChunk);

    return json({ received: index, total }, 202);
  }

  if (body.action !== 'finalize') {
    return json({ error: 'Ação de upload inválida.' }, 400);
  }

  const storedChunks = await Promise.all(
    Array.from({ length: total }, (_, index) =>
      uploadStore.get<StoredChunk>(chunkKey(auth.sub, uploadId, index))),
  );
  const missingIndex = storedChunks.findIndex((chunk) => !chunk?.value);
  if (missingIndex >= 0) {
    return json({ error: `Fragmento ${missingIndex + 1}/${total} não foi recebido.` }, 409);
  }

  const serializedPayload = storedChunks.map((chunk) => chunk?.value || '').join('');
  if (getUtf8ByteLength(serializedPayload) > MAX_VISIT_PAYLOAD_BYTES) {
    await removeUploadChunks(auth.sub, uploadId, total);
    return json({ error: 'A visita excede o limite seguro de 64 MB.' }, 413);
  }

  const reconstructedUploadId = createHash('sha256')
    .update(serializedPayload)
    .digest('hex')
    .slice(0, 32);
  if (reconstructedUploadId !== uploadId) {
    await removeUploadChunks(auth.sub, uploadId, total);
    return json({ error: 'A verificação de integridade do upload falhou.' }, 409);
  }

  let payload: any;
  try {
    payload = JSON.parse(serializedPayload);
  } catch {
    return json({ error: 'Não foi possível reconstruir a visita. Reenvie os fragmentos.' }, 400);
  }

  if (payload?.visitId && String(payload.visitId) !== visitId) {
    await removeUploadChunks(auth.sub, uploadId, total);
    return json({ error: 'O ID da visita não corresponde ao upload.' }, 409);
  }

  const record = await upsertVisit({
    ...payload,
    visitId: visitId || generateVisitId(),
    user: {
      id: auth.sub,
      name: auth.name,
      role: auth.role,
      region: auth.region,
      user: auth.user,
    },
  });

  await removeUploadChunks(auth.sub, uploadId, total);

  return json({
    visitId: record.visitId,
    syncStatus: record.syncStatus,
    updatedAt: record.updatedAt,
    chunked: true,
  }, 201);
};

export const config: Config = {
  path: '/api/visits/upload',
  method: ['POST'],
};
