import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { storeLocalPhoto, readLocalPhoto, pruneConfirmedPhotos, PHOTO_RETENTION_MS } from '../src/services/litePhotos.ts';
import { auditLocalVisitPhotos } from '../src/services/localPhotoAudit.ts';
import { upsertQueuedVisit } from '../src/services/syncQueue.ts';

const memory = new Map<string, string>();
Object.assign(globalThis, { window: globalThis, localStorage: { getItem: (k: string) => memory.get(k) || null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) } });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (_name: string, work: () => Promise<unknown>) => work() } } });

test('conferencia contabiliza foto ausente e duplicacoes sem alterar as fotos restantes', async () => {
  const owner = 'audit-owner', one = await storeLocalPhoto(owner, 'foto-1'), two = await storeLocalPhoto(owner, 'foto-2');
  const missing = 'criativa-photo-v1:audit-owner:missing';
  const payload = { photos: { FACHADA: [one] }, industryExecutions: { TESTE: { photos: { ANTES: [two, missing], DEPOIS: ['foto-antiga'] } } }, returnsPhotosByIndustry: { TESTE: [two] } };
  const report = await auditLocalVisitPhotos(owner, payload, () => owner);
  assert.deepEqual(report, { total: 4, readable: 3, missing: 1, differentOwner: 0, unverified: 0 });
  assert.equal(await readLocalPhoto(owner, one), 'foto-1'); assert.equal(await readLocalPhoto(owner, two), 'foto-2');
});

test('falha do banco nao e classificada como exclusao e conta diferente nao e lida', async () => {
  const owner = 'audit-read-failure', ref = await storeLocalPhoto(owner, 'preservada');
  const other = await storeLocalPhoto('another-owner', 'privada');
  const original = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get = function(key: IDBValidKey) {
    const request = original.call(this, key);
    if (key === ref) request.addEventListener('success', () => this.transaction.abort());
    return request;
  };
  try {
    const result = await auditLocalVisitPhotos(owner, { photos: { ANTES: [ref, other] } }, () => owner);
    assert.deepEqual(result, { total: 2, readable: 0, missing: 0, differentOwner: 1, unverified: 1 });
  } finally { IDBObjectStore.prototype.get = original; }
  assert.equal(await readLocalPhoto(owner, ref), 'preservada');
  await assert.rejects(auditLocalVisitPhotos(owner, { photos: { ANTES: [ref] } }, () => 'different'), /sessao mudou/);
});

test('fila com mais de uma semana bloqueia limpeza; conferenciar nao altera dados nem finaliza', async () => {
  const owner = 'week-old', refs: string[] = [];
  for (let i = 0; i < 26; i++) refs.push(await storeLocalPhoto(owner, `preservada-${i}`, { visitId: 'VISIT-WEEK-OLD', storeId: 's', section: 'ANTES', industry: 'TESTE', capturedAt: '2026-11-17T12:00:00Z' }));
  refs.push('criativa-photo-v1:week-old:missing');
  const payload = { user: { id: owner }, photos: { ANTES: refs } };
  await upsertQueuedVisit(owner, payload, 'VISIT-WEEK-OLD');
  assert.equal(await pruneConfirmedPhotos(owner, Date.now() + 10 * PHOTO_RETENTION_MS), 0);
  assert.deepEqual(await auditLocalVisitPhotos(owner, payload, () => owner), { total: 27, readable: 26, missing: 1, differentOwner: 0, unverified: 0 });
  for (let i = 0; i < 26; i++) assert.equal(await readLocalPhoto(owner, refs[i]), `preservada-${i}`);
});
