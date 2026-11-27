import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { preserveCompletedVisit, isConfirmedCheckout } from '../src/services/completedVisitQueue.ts';
import { getQueuedVisit, upsertQueuedVisit } from '../src/services/syncQueue.ts';

const memory = new Map<string, string>();
Object.assign(globalThis, { window: globalThis, localStorage: { getItem: (k: string) => memory.get(k) || null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) } });
const owner = 'completed-owner';
const draft = (visitId: string) => ({ visitId, user: { id: owner }, checkInDone: true, checkInTime: '2026-11-17T12:00:00Z', checkOutTime: '2026-11-17T15:00:00Z', tasks: { CHECKOUT: true }, photos: { FACHADA: ['entry'], CHECKOUT: ['exit'] }, industryExecutions: { TESTE: { photos: { ANTES: ['before'], DEPOIS: ['after'] } } }, returnsPhotosByIndustry: { TESTE: ['return'] } }) as any;

test('saida antiga e preservada na fila com todas as fotos e horario original', async () => {
  const state = draft('VISIT-COMPLETE'); assert.equal(isConfirmedCheckout(state), true);
  await preserveCompletedVisit(owner, state);
  const queued = await getQueuedVisit(owner, state.visitId);
  assert.equal(queued?.payload.checkOutTime, state.checkOutTime);
  assert.deepEqual(queued?.payload.industryExecutions, state.industryExecutions);
  assert.deepEqual(queued?.payload.returnsPhotosByIndustry, state.returnsPhotosByIndustry);
  assert.equal(queued?.status, 'pending');
});

test('copia mais rica ja na fila nao e reduzida nem reinicializada', async () => {
  const state = draft('VISIT-RICHER'); const rich = { ...state, photos: { ...state.photos, ESTOQUE: ['extra'] } };
  await upsertQueuedVisit(owner, rich, state.visitId, 'syncing');
  await preserveCompletedVisit(owner, state);
  const queued = await getQueuedVisit(owner, state.visitId);
  assert.equal(queued?.status, 'syncing'); assert.deepEqual(queued?.payload.photos.ESTOQUE, ['extra']);
});

test('divergencia e transacao abortada preservam ambas as evidencias; nao liberam visita', async () => {
  const state = draft('VISIT-DIFFERENT');
  await upsertQueuedVisit(owner, { ...state, photos: { ...state.photos, ESTOQUE: ['only-queue'] } }, state.visitId);
  await assert.rejects(preserveCompletedVisit(owner, { ...state, photos: { ...state.photos, ESTOQUE: ['only-draft'] } }), /Ambas/);
  assert.deepEqual((await getQueuedVisit(owner, state.visitId))?.payload.photos.ESTOQUE, ['only-queue']);
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function(value: any, key?: IDBValidKey) {
    const request = key === undefined ? original.call(this, value) : original.call(this, value, key);
    if (this.name === 'queued-visits') request.addEventListener('success', () => this.transaction.abort()); return request;
  };
  const abort = draft('VISIT-QUEUE-ABORT');
  try { await assert.rejects(preserveCompletedVisit(owner, abort)); }
  finally { IDBObjectStore.prototype.put = original; }
  assert.equal(await getQueuedVisit(owner, abort.visitId), null);
  assert.equal(abort.photos.CHECKOUT[0], 'exit');
  await preserveCompletedVisit(owner, abort); assert.ok(await getQueuedVisit(owner, abort.visitId));
});

test('foto sem confirmar saida e conta diferente nao geram encerramento', async () => {
  const state = draft('VISIT-NOT-CLOSED');
  for (const patch of [{ checkOutTime: null }, { tasks: {} }, { photos: {} }]) {
    const incomplete = { ...state, ...patch }; assert.equal(isConfirmedCheckout(incomplete), false);
    await assert.rejects(preserveCompletedVisit(owner, incomplete));
  }
  await assert.rejects(preserveCompletedVisit('other-owner', state));
});
