import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { isLocalPhoto } from './litePhotos.ts';
import { getUtf8ByteLength, splitUtf8Text, VISIT_PAYLOAD_CHUNK_MAX_BYTES } from './visitPayload.ts';

type ResolvePhoto = (id: string) => Promise<string>;
type Send = (body: any) => Promise<any>;

// Yield JSON tokens, resolving just one local image at a time. No full payload string.
async function* jsonTokens(value: any, resolve: ResolvePhoto): AsyncGenerator<string> {
  if (isLocalPhoto(value)) { yield JSON.stringify(await resolve(value)); return; }
  if (Array.isArray(value)) {
    yield '[';
    for (let index = 0; index < value.length; index++) {
      if (index) yield ',';
      yield* jsonTokens(value[index] ?? null, resolve);
    }
    yield ']';
  } else if (value && typeof value === 'object') {
    yield '{';
    let first = true;
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      if (!first) yield ',';
      first = false;
      yield JSON.stringify(key) + ':';
      yield* jsonTokens(item, resolve);
    }
    yield '}';
  } else {
    const text = JSON.stringify(value);
    if (text === undefined) throw new Error('Dados de visita invalidos.');
    yield text;
  }
}

export async function* liteChunks(payload: any, resolve: ResolvePhoto, limit = VISIT_PAYLOAD_CHUNK_MAX_BYTES) {
  let buffer = '';
  let size = 0;
  for await (const token of jsonTokens(payload, resolve)) {
    for (const part of splitUtf8Text(token, limit)) {
      const bytes = getUtf8ByteLength(part);
      if (size + bytes > limit && buffer) { yield buffer; buffer = ''; size = 0; }
      buffer += part;
      size += bytes;
    }
  }
  if (buffer) yield buffer;
}

export const sendLiteVisit = async (payload: any, resolve: ResolvePhoto, send: Send) => {
  const digest = sha256.create();
  let total = 0;
  let bytes = 0;
  for await (const chunk of liteChunks(payload, resolve)) {
    digest.update(new TextEncoder().encode(chunk));
    bytes += getUtf8ByteLength(chunk);
    if (++total > 48 || bytes > 64 * 1024 * 1024) throw new Error('Visita acima do limite seguro. Dados preservados.');
  }
  const uploadId = bytesToHex(digest.digest()).slice(0, 32);
  const envelope = { uploadId, visitId: payload.visitId, total };
  const status = await send({ ...envelope, action: 'status' });
  const received = new Set(Array.isArray(status.receivedIndexes) ? status.receivedIndexes : []);
  const verification = sha256.create();
  let index = 0;
  for await (const chunk of liteChunks(payload, resolve)) {
    verification.update(new TextEncoder().encode(chunk));
    if (!received.has(index)) await send({ ...envelope, action: 'chunk', index, chunk });
    index++;
  }
  if (index !== total || bytesToHex(verification.digest()).slice(0, 32) !== uploadId) {
    throw new Error('O conteudo local mudou. Repita o envio; a visita foi preservada.');
  }
  return send({ ...envelope, action: 'finalize' });
};
