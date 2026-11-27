import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { upsertQueuedVisit, getQueuedVisit } from '../src/services/syncQueue.ts';
import { deliverQueuedVisit } from '../src/services/queuedVisitDelivery.ts';
import { confirmQueuedVisit } from '../src/services/confirmQueuedVisit.ts';

const memory = new Map<string, string>();
Object.assign(globalThis, { window: globalThis, localStorage: { getItem: (k: string) => memory.get(k) || null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) } });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const owner = 'queue-recovery';
const payload = { user: { id: owner }, photos: { CHECKOUT: ['saved-photo'] }, checkOutTime: '2026-11-17T15:00:00Z' };

test('fila manual em syncing sem registro remoto retoma upload com mesmo ID e preserva fotos ate confirmacao', async () => {
  const id = 'VISIT-MANUAL-STALE'; await upsertQueuedVisit(owner, payload, id, 'syncing');
  let creates = 0;
  await deliverQueuedVisit(owner, id, {
    status: async () => { throw Object.assign(new Error('missing'), { status: 404 }); },
    create: async p => { creates++; assert.equal(p.visitId, id); assert.deepEqual(p.photos, payload.photos); return { visitId: id, syncStarted: true }; },
    start: async () => { throw new Error('nao duplicar disparo'); },
  }, () => owner);
  assert.equal(creates, 1); assert.deepEqual((await getQueuedVisit(owner, id))?.payload.photos, payload.photos);
  await deliverQueuedVisit(owner, id, {
    status: async () => ({ syncStatus: 'enviado' }),
    create: async () => { throw Error('nao recriar'); }, start: async () => { throw Error('nao reiniciar'); },
  }, () => owner);
  assert.equal(await getQueuedVisit(owner, id), null);
});

test('clique manual simultaneo com retomada automatica compartilha um unico upload', async () => {
  const id = 'VISIT-SHARED'; await upsertQueuedVisit(owner, payload, id);
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }); let creates = 0;
  const transport = {
    status: async () => { await wait; throw Object.assign(Error('missing'), { status: 404 }); },
    create: async () => { creates++; return { visitId: id, syncStarted: true }; }, start: async () => {},
  };
  const one = deliverQueuedVisit(owner, id, transport, () => owner), two = deliverQueuedVisit(owner, id, transport, () => owner);
  assert.equal(one, two); release(); await Promise.all([one, two]); assert.equal(creates, 1);
});

test('rede e 502 preservam fila para retomada; sessao substituida nao envia nem altera dados', async () => {
  for (const error of [new TypeError('Failed to fetch'), Object.assign(Error('502'), { status: 502 })]) {
    const id = 'VISIT-FAIL-' + (error as any).status; await upsertQueuedVisit(owner, payload, id);
    await assert.rejects(deliverQueuedVisit(owner, id, { status: async () => { throw error; }, create: async () => { throw Error('nao criar'); }, start: async () => {} }, () => owner));
    const queued = await getQueuedVisit(owner, id); assert.equal(queued?.status, 'pending'); assert.deepEqual(queued?.payload.photos, payload.photos);
  }
  const id = 'VISIT-OWNER-CHANGE'; await upsertQueuedVisit(owner, payload, id); let current = owner;
  await assert.rejects(deliverQueuedVisit(owner, id, {
    status: async () => { current = 'another-owner'; throw Object.assign(Error('404'), { status: 404 }); },
    create: async () => { throw Error('outro usuario nao pode enviar'); }, start: async () => {},
  }, () => current), /sessao mudou/);
  assert.equal((await getQueuedVisit(owner, id))?.status, 'pending');
});

test('visita com erro remoto nao e sobrescrita nem reiniciada sem retry autorizado', async () => {
  const id = 'VISIT-REMOTE-ERROR'; await upsertQueuedVisit(owner, payload, id);
  await assert.rejects(deliverQueuedVisit(owner, id, {
    status: async () => ({ syncStatus: 'erro', syncError: 'precisa suporte' }),
    create: async () => { throw Error('nao sobrescrever'); }, start: async () => { throw Error('nao reiniciar'); },
  }, () => owner), /precisa suporte/);
  assert.equal((await getQueuedVisit(owner, id))?.status, 'error');
});

test('confirmacoes concorrentes nao leem copias repetidas da visita e falha permite repetir', async () => {
  const id = 'VISIT-CONFIRM-SHARED'; await upsertQueuedVisit(owner, payload, id);
  const original = IDBObjectStore.prototype.get; let reads = 0;
  IDBObjectStore.prototype.get = function(key: IDBValidKey) { if (this.name === 'queued-visits' && key === id) reads++; return original.call(this, key); };
  try {
    const first = confirmQueuedVisit(owner, id, 'enviado');
    const others = Array.from({ length: 25 }, () => confirmQueuedVisit(owner, id, 'enviado'));
    assert.ok(others.every(promise => promise === first));
    await assert.rejects(confirmQueuedVisit(owner, id, 'enviando'));
    await Promise.all(others);
    assert.equal(reads, 2); // Confirmation and ownership check for removal.
  } finally { IDBObjectStore.prototype.get = original; }
  assert.equal(await getQueuedVisit(owner, id), null);
});

test('falha ao retirar fila confirmada libera a operacao e preserva dados para repetir', async () => {
  const id = 'VISIT-CONFIRM-ABORT'; await upsertQueuedVisit(owner, payload, id);
  const original = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete = function(key: IDBValidKey) {
    const request = original.call(this, key);
    if (this.name === 'queued-visits' && key === id) request.addEventListener('success', () => this.transaction.abort());
    return request;
  };
  try { await assert.rejects(confirmQueuedVisit(owner, id, 'enviado')); }
  finally { IDBObjectStore.prototype.delete = original; }
  assert.deepEqual((await getQueuedVisit(owner, id))?.payload.photos, payload.photos);
  await confirmQueuedVisit(owner, id, 'enviado'); assert.equal(await getQueuedVisit(owner, id), null);
});
