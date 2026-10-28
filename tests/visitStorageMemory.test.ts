import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';

const memoryStorage = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStorage.set(key, value),
    removeItem: (key: string) => memoryStorage.delete(key),
  },
});

const storage = await import('../src/services/visitStorage.ts');

test('coalesce salvamentos rapidos e preserva o rascunho mais recente', async () => {
  const base = {
    user: { id: 'promotor-a' },
    draftOwnerId: 'promotor-a',
    photos: {},
    industryExecutions: {},
  } as any;

  const saves = [1, 2, 3].map((sequence) => storage.saveVisitDraft('draft-test', {
    ...base,
    sequence,
    photos: { checkout: [`foto-${sequence}`] },
    returnsPhotosByIndustry: { Industria: [`devolucao-${sequence}`] },
    industryExecutions: { Industria: { photos: { ANTES: [`antes-${sequence}`] } } },
  }));
  await Promise.all(saves);

  const restored = await storage.loadVisitDraft('draft-test') as any;
  assert.equal(restored.sequence, 3);
  assert.equal(restored.photos.checkout[0], 'foto-3');
  assert.equal(restored.returnsPhotosByIndustry.Industria[0], 'devolucao-3');
  assert.equal(restored.industryExecutions.Industria.photos.ANTES[0], 'antes-3');

  const compatibility = JSON.parse(memoryStorage.get('draft-test') || '{}');
  assert.deepEqual(compatibility.photos.checkout, []);
  assert.deepEqual(compatibility.returnsPhotosByIndustry.Industria, []);
  assert.deepEqual(compatibility.industryExecutions.Industria.photos.ANTES, []);
});

test('restaura IndexedDB sem ler ou duplicar o rascunho legado', async () => {
  const original = localStorage.getItem;
  localStorage.getItem = () => { throw new Error('O legado nao deve ser lido'); };
  try {
    const restored = await storage.loadVisitDraft('draft-test') as any;
    assert.equal(restored.photos.checkout[0], 'foto-3');
    assert.equal(restored.returnsPhotosByIndustry.Industria[0], 'devolucao-3');
  } finally {
    localStorage.getItem = original;
  }
});

test('navegacao e renovacao da sessao nao regravam fotos; evidencia continua salva', async () => {
  const original = IDBObjectStore.prototype.put;
  const writes: IDBValidKey[] = [];
  IDBObjectStore.prototype.put = function(value: any, key?: IDBValidKey) {
    writes.push(key!);
    return original.call(this, value, key);
  };
  try {
    const state = {
      user: { id: 'memory-owner', name: 'Promotor', role: 'FIELD_OPS', user: 'teste' },
      draftOwnerId: 'memory-owner', visitId: 'VISIT-MEMORY', step: 'ANTES',
      photos: { FACHADA: ['fachada-preservada'] },
      returnsPhotosByIndustry: { Industria: ['devolucao-preservada'] },
      industryExecutions: { Industria: { photos: { ANTES: ['A'.repeat(4_000_000)] } } },
      tasks: {}, stockQuantities: {}, aiResults: {}, availableStores: [], industries: [],
    } as any;
    await storage.saveVisitDraft('memory-test', state);
    writes.length = 0;
    await storage.saveVisitDraft('memory-test', { ...state, user: { ...state.user }, industries: ['Industria'], availableStores: [{ id: '1' }] });
    assert.deepEqual(writes, []);
    await storage.saveVisitDraft('memory-test', { ...state, step: 'DEPOIS' });
    assert.deepEqual(writes, ['active-visit-position']);
    let restored = await storage.loadVisitDraft('memory-test') as any;
    assert.equal(restored.step, 'DEPOIS');
    assert.equal(restored.industryExecutions.Industria.photos.ANTES[0].length, 4_000_000);
    assert.equal(restored.returnsPhotosByIndustry.Industria[0], 'devolucao-preservada');
    writes.length = 0;
    await storage.saveVisitDraft('memory-test', { ...restored, user: { ...restored.user }, industries: ['atualizada'] });
    assert.deepEqual(writes, []);

    const edited = { ...state, step: 'DEPOIS', photos: { ...state.photos, CHECKOUT: ['nova-foto'] }, tasks: { CHECKOUT: true } };
    writes.length = 0;
    await storage.saveVisitDraft('memory-test', edited);
    assert.deepEqual(writes, ['active-visit', 'active-visit-position']);
    restored = await storage.loadVisitDraft('memory-test') as any;
    assert.equal(restored.photos.CHECKOUT[0], 'nova-foto');
    assert.equal(restored.tasks.CHECKOUT, true);

    await storage.saveVisitDraft('memory-test', { ...edited, draftOwnerId: 'other-owner', user: { id: 'other-owner' }, visitId: 'VISIT-OTHER', step: 'FACHADA' });
    restored = await storage.loadVisitDraft('memory-test') as any;
    assert.equal(restored.visitId, 'VISIT-OTHER');
    assert.equal(restored.step, 'FACHADA');
  } finally {
    IDBObjectStore.prototype.put = original;
  }
});

test('transacao interrompida preserva rascunho anterior e permite nova tentativa', async () => {
  const before = { user: null, draftOwnerId: 'abort-owner', visitId: 'VISIT-ABORT', step: 'ANTES', photos: { ANTES: ['anterior'] }, industryExecutions: {} } as any;
  await storage.saveVisitDraft('abort-test', before);
  const original = IDBObjectStore.prototype.put;
  let interrupted = false;
  IDBObjectStore.prototype.put = function(value: any, key?: IDBValidKey) {
    const request = original.call(this, value, key);
    if (key === 'active-visit' && !interrupted) {
      interrupted = true;
      const transaction = this.transaction;
      request.addEventListener('success', () => transaction.abort());
    }
    return request;
  };
  const after = { ...before, step: 'DEPOIS', photos: { ANTES: ['anterior'], DEPOIS: ['nova'] } };
  try { await assert.rejects(storage.saveVisitDraft('abort-test', after)); }
  finally { IDBObjectStore.prototype.put = original; }
  let restored = await storage.loadVisitDraft('abort-test') as any;
  assert.deepEqual(restored.photos, before.photos);
  assert.equal(restored.step, 'ANTES');
  await storage.saveVisitDraft('abort-test', after);
  restored = await storage.loadVisitDraft('abort-test') as any;
  assert.deepEqual(restored.photos, after.photos);
  assert.equal(restored.step, 'DEPOIS');
});

test('falha na compatibilidade nao impede repetir salvamento integral', async () => {
  const original = localStorage.setItem;
  const state = { user: null, draftOwnerId: 'retry-owner', visitId: 'VISIT-RETRY', step: 'ANTES', photos: { ANTES: ['foto-retry'] }, industryExecutions: {} } as any;
  localStorage.setItem = () => { throw new Error('Quota simulada'); };
  try {
    await assert.rejects(storage.saveVisitDraft('retry-test', state), /Quota simulada/);
  } finally { localStorage.setItem = original; }
  await storage.saveVisitDraft('retry-test', state);
  const restored = await storage.loadVisitDraft('retry-test') as any;
  assert.equal(restored.photos.ANTES[0], 'foto-retry');
  assert.ok(memoryStorage.has('retry-test'));
});
