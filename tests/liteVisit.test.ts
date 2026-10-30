import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import 'fake-indexeddb/auto';
import { storeLocalPhoto, readLocalPhoto, hasLocalPhotos } from '../src/services/litePhotos.ts';
import { sendLiteVisit, liteChunks } from '../src/services/liteUpload.ts';
import { getUtf8ByteLength, VISIT_PAYLOAD_CHUNK_MAX_BYTES } from '../src/services/visitPayload.ts';
import { buildMakePhotoEvents, buildMakeVisitFinalizeEvent } from '../netlify/functions/_shared/make-contract-v2.ts';

const memory = new Map<string, string>();
Object.assign(globalThis, { window: globalThis, localStorage: {
  getItem: (key: string) => memory.get(key) || null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
} });

test('foto individual, rascunho e fila preservam referencias e isolamento por dono', async () => {
  const photo = 'A'.repeat(140_000);
  const id = await storeLocalPhoto('lite-owner', photo);
  assert.ok(id.length < 150);
  assert.equal(await readLocalPhoto('lite-owner', id), photo);
  await assert.rejects(readLocalPhoto('other-owner', id), /outro usuario/);
  const { saveVisitDraft, loadVisitDraft } = await import('../src/services/visitStorage.ts');
  const queue = await import('../src/services/syncQueue.ts');
  const draft = { user: { id: 'lite-owner' }, draftOwnerId: 'lite-owner', visitId: 'VISIT-LITE', step: 'DASHBOARD', photos: { FACHADA: [id] }, industryExecutions: {} } as any;
  await saveVisitDraft('lite-draft', draft);
  const restored = await loadVisitDraft('lite-draft');
  assert.equal(restored?.photos.FACHADA[0], id);
  await queue.upsertQueuedVisit('lite-owner', draft, 'VISIT-LITE');
  await queue.updateQueuedVisit('lite-owner', 'VISIT-LITE', { status: 'error' });
  const queued = await queue.getQueuedVisit('lite-owner', 'VISIT-LITE');
  assert.equal(queued?.payload.photos.FACHADA[0], id);
  assert.ok(JSON.stringify(queued).length < 1000);
  assert.equal(await readLocalPhoto('lite-owner', queued!.payload.photos.FACHADA[0]), photo);
  await queue.removeQueuedVisit('lite-owner', 'VISIT-LITE');
  assert.equal(await queue.getQueuedVisit('lite-owner', 'VISIT-LITE'), null);
  assert.equal(await readLocalPhoto('lite-owner', id), photo);
});

test('100 fotos sao enviadas sequencialmente com hash e contrato iguais ao JSON original', async () => {
  const ids = await Promise.all(Array.from({ length: 100 }, (_, i) => storeLocalPhoto('owner', `${i}${'A'.repeat(120_000)}`)));
  const payload = { visitId: 'VISIT-STREAM', user: { id: 'owner' }, store: 'Loja \u00e3 \ud83d\ude00', optional: undefined, photos: ids, industryExecutions: {} };
  assert.equal(hasLocalPhotos(payload), true);
  assert.ok(JSON.stringify(payload).length < 12000);
  const chunks: string[] = [];
  let active = 0, maxActive = 0;
  let envelope: any;
  const result = await sendLiteVisit(payload, id => readLocalPhoto('owner', id), async body => {
    if (body.action === 'status') { envelope = body; return { receivedIndexes: [] }; }
    if (body.action === 'chunk') {
      active++; maxActive = Math.max(maxActive, active);
      assert.ok(getUtf8ByteLength(body.chunk) <= VISIT_PAYLOAD_CHUNK_MAX_BYTES);
      chunks[body.index] = body.chunk;
      await new Promise(resolve => setTimeout(resolve, 0)); active--; return {};
    }
    const reconstructed = chunks.join('');
    assert.equal(createHash('sha256').update(reconstructed).digest('hex').slice(0, 32), body.uploadId);
    const parsed = JSON.parse(reconstructed);
    assert.equal(parsed.photos.length, 100);
    for (let i = 0; i < ids.length; i++) assert.equal(parsed.photos[i], await readLocalPhoto('owner', ids[i]));
    assert.equal(parsed.store, payload.store);
    assert.equal('optional' in parsed, false);
    assert.equal(hasLocalPhotos(parsed), false);
    return { visitId: body.visitId, syncStarted: true };
  });
  assert.equal(maxActive, 1);
  assert.ok(envelope.total > 1);
  assert.equal(result.visitId, payload.visitId);
});

test('interrupcao retoma somente fragmentos ausentes com mesmo hash', async () => {
  const id = await storeLocalPhoto('retry', 'B'.repeat(160_000));
  const payload = { visitId: 'VISIT-RETRY', photos: Array(30).fill(id) };
  const chunks = new Map<number, string>(); const hashes = new Set<string>();
  let fail = true; let duplicate = 0;
  const send = async (body: any) => {
    hashes.add(body.uploadId);
    if (body.action === 'status') return { receivedIndexes: [...chunks.keys()] };
    if (body.action === 'chunk') {
      if (body.index === 1 && fail) { fail = false; throw new Error('offline'); }
      if (chunks.has(body.index)) duplicate++;
      chunks.set(body.index, body.chunk); return {};
    }
    assert.equal(JSON.parse([...chunks.values()].join('')).photos.length, 30);
    return { visitId: body.visitId };
  };
  await assert.rejects(sendLiteVisit(payload, ref => readLocalPhoto('retry', ref), send), /offline/);
  await sendLiteVisit(payload, ref => readLocalPhoto('retry', ref), send);
  assert.equal(hashes.size, 1);
  assert.equal(duplicate, 0);
  assert.equal(await readLocalPhoto('retry', id), 'B'.repeat(160_000));
});

test('foto ausente bloqueia envio sem finalizar visita incompleta', async () => {
  let requests = 0;
  const id = 'criativa-photo-v1:missing:unknown';
  await assert.rejects(sendLiteVisit({ visitId: 'VISIT-MISSING', photos: [id] }, ref => readLocalPhoto('missing', ref), async () => { requests++; }), /indisponivel/);
  assert.equal(requests, 0);
});

test('JSON misto preserva fotos antigas, Unicode, null e limites de fragmento', async () => {
  const id = await storeLocalPhoto('mixed', 'AAAABBBB');
  const payload = { title: '\u00e3\u20ac\ud83d\ude00', photos: ['foto-antiga', id], nested: { empty: null, list: [undefined, false, 3] } };
  let result = '';
  for await (const chunk of liteChunks(payload, ref => readLocalPhoto('mixed', ref), 20)) {
    assert.ok(getUtf8ByteLength(chunk) <= 20); result += chunk;
  }
  assert.equal(result, JSON.stringify({ ...payload, photos: ['foto-antiga', 'AAAABBBB'] }));
});

test('falha de armazenamento nao entrega referencia para foto nao confirmada', async () => {
  const original = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function(value: any) {
    const request = original.call(this, value);
    const tx = this.transaction;
    request.addEventListener('success', () => tx.abort());
    return request;
  };
  try { await assert.rejects(storeLocalPhoto('abort', 'foto-nao-confirmada')); }
  finally { IDBObjectStore.prototype.add = original; }
});

test('contrato Google recebe mesmas fotos, pastas e IDs da visita original', async () => {
  const base64 = Buffer.from('foto-teste'.repeat(200)).toString('base64');
  const ref = await storeLocalPhoto('contract', base64);
  const payload = { visitId: 'VISIT-CONTRACT', user: { id: 'contract', name: 'Teste' }, currentStore: 'PDV Teste', checkInTime: '2026-10-30T12:00:00Z', checkOutTime: '2026-10-30T13:00:00Z', photos: { FACHADA: [ref], CHECKOUT: [ref] }, industryExecutions: { TESTE: { photos: { ANTES: [ref], DEPOIS: [ref] }, hasReturns: false } } };
  let text = '';
  for await (const chunk of liteChunks(payload, id => readLocalPhoto('contract', id))) text += chunk;
  const resolved = JSON.parse(text);
  const original = JSON.parse(JSON.stringify(payload).replaceAll(ref, base64));
  assert.deepEqual(buildMakePhotoEvents(resolved), buildMakePhotoEvents(original));
  const manifest = { photos: {} } as any;
  assert.deepEqual(buildMakeVisitFinalizeEvent(resolved, buildMakePhotoEvents(resolved), manifest),
    buildMakeVisitFinalizeEvent(original, buildMakePhotoEvents(original), manifest));
});

test('mudanca do conteudo entre leituras bloqueia finalizacao', async () => {
  let reads = 0;
  let finalizeCalls = 0;
  await assert.rejects(sendLiteVisit({ visitId: 'VISIT-MUTATE', photos: ['criativa-photo-v1:owner:one'] },
    async () => ++reads === 1 ? 'AAAA' : 'BBBB', async body => {
      if (body.action === 'finalize') finalizeCalls++;
      return { receivedIndexes: [] };
    }), /conteudo local mudou/);
  assert.equal(finalizeCalls, 0);
});
