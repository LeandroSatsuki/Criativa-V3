import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { AUTHORIZED_DISCARD, canDiscardAuthorizedVisit, wasVisitDiscarded } from '../src/services/authorizedQueueDiscard.ts';
import { discardAuthorizedQueue } from '../src/services/discardAuthorizedQueue.ts';
import { upsertQueuedVisit, getQueuedVisit } from '../src/services/syncQueue.ts';
import { loadVisitDraft, saveVisitDraft } from '../src/services/visitStorage.ts';
import { deliverQueuedVisit } from '../src/services/queuedVisitDelivery.ts';

const memory = new Map<string, string>();
Object.assign(globalThis, { window: globalThis, localStorage: { getItem: (k: string) => memory.get(k) || null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) } });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const user = { id: AUTHORIZED_DISCARD.ownerId, user: AUTHORIZED_DISCARD.login }, id = AUTHORIZED_DISCARD.visitId;
const payload = { user, photos: { CHECKOUT: ['preservada'] }, checkOutTime: '2026-11-17T15:00:00Z' };
const archive = () => new Promise<any>((resolve, reject) => {
  const r = indexedDB.open('criativa-field-ops', 1);
  r.onsuccess = () => { const db = r.result; const tx = db.transaction('visit-drafts'); const q = tx.objectStore('visit-drafts').get(`abandoned-queue:${user.id}:${id}`); tx.oncomplete = () => { db.close(); resolve(q.result); }; tx.onabort = tx.onerror = () => reject(tx.error); };
});

test('remove apenas ID autorizado, preserva rascunho novo, outra fila e copia; bloqueia recriacao', async () => {
  memory.clear(); await upsertQueuedVisit(user.id, payload, id, 'error');
  await upsertQueuedVisit(user.id, { ...payload, currentStore: 'LOJA NOVA' }, 'VISIT-NEW-PRESERVED');
  await upsertQueuedVisit('other', { user: { id: 'other' }, photos: { ANTES: ['outra'] } }, 'VISIT-OTHER-PRESERVED');
  const draft = { ...payload, draftOwnerId: user.id, visitId: 'VISIT-NEW-PRESERVED', photos: { FACHADA: ['entrada-nova'] }, step: 'ANTES' } as any;
  await saveVisitDraft('discard-test', draft);
  await discardAuthorizedQueue(user, id, () => user.id);
  assert.equal(await getQueuedVisit(user.id, id), null);
  assert.equal((await getQueuedVisit(user.id, 'VISIT-NEW-PRESERVED'))?.payload.currentStore, 'LOJA NOVA');
  assert.deepEqual((await getQueuedVisit('other', 'VISIT-OTHER-PRESERVED'))?.payload.photos, { ANTES: ['outra'] });
  assert.equal((await loadVisitDraft('discard-test', user.id))?.visitId, draft.visitId);
  assert.deepEqual((await archive()).queued.payload.photos, payload.photos);
  assert.equal(wasVisitDiscarded(user.id, id), true);
  await assert.rejects(upsertQueuedVisit(user.id, payload, id), /removido por autorizacao/);
  assert.equal(await deliverQueuedVisit(user.id, id, {
    status: async () => { throw Error('nao enviar descartada'); }, create: async () => { throw Error('nao recriar'); }, start: async () => {},
  }, () => user.id), 'missing');
});

test('outra conta, login ou ID nao recebe a acao destrutiva', async () => {
  assert.equal(canDiscardAuthorizedVisit(user, id), true);
  for (const wrong of [{ id: 'other', user: user.user }, { id: user.id, user: 'another' }]) {
    assert.equal(canDiscardAuthorizedVisit(wrong, id), false);
    await assert.rejects(discardAuthorizedQueue(wrong, id, () => wrong.id), /nao autorizada/);
  }
  assert.equal(canDiscardAuthorizedVisit(user, 'VISIT-NEW-PRESERVED'), false);
  await assert.rejects(discardAuthorizedQueue(user, 'VISIT-NEW-PRESERVED', () => user.id), /nao autorizada/);
});

test('falha no backup ou no marcador mantem fila; repeticao segura funciona', async () => {
  memory.clear(); await upsertQueuedVisit(user.id, payload, id, 'error');
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function(value: any, key?: IDBValidKey) {
    const request = key === undefined ? original.call(this, value) : original.call(this, value, key);
    if (String(key).startsWith('abandoned-queue:')) request.addEventListener('success', () => this.transaction.abort());
    return request;
  };
  try { await assert.rejects(discardAuthorizedQueue(user, id, () => user.id)); }
  finally { IDBObjectStore.prototype.put = original; }
  assert.ok(await getQueuedVisit(user.id, id)); assert.equal(wasVisitDiscarded(user.id, id), false);
  const set = localStorage.setItem;
  localStorage.setItem = () => { throw Error('quota simulada'); };
  try { await assert.rejects(discardAuthorizedQueue(user, id, () => user.id), /quota simulada/); }
  finally { localStorage.setItem = set; }
  assert.ok(await getQueuedVisit(user.id, id)); assert.equal(wasVisitDiscarded(user.id, id), false);
  await discardAuthorizedQueue(user, id, () => user.id); assert.equal(await getQueuedVisit(user.id, id), null);
});

test('nao descarta enquanto upload esta ativo nem apos mudar de conta', async () => {
  memory.clear(); await upsertQueuedVisit(user.id, payload, id, 'error');
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
  const active = deliverQueuedVisit(user.id, id, { status: async () => { await wait; throw Object.assign(Error('502'), { status: 502 }); }, create: async () => ({}), start: async () => {} }, () => user.id);
  await assert.rejects(discardAuthorizedQueue(user, id, () => user.id), /Aguarde/);
  release(); await assert.rejects(active);
  await assert.rejects(discardAuthorizedQueue(user, id, () => 'other'), /nao autorizada/);
  assert.ok(await getQueuedVisit(user.id, id)); assert.equal(wasVisitDiscarded(user.id, id), false);
});
