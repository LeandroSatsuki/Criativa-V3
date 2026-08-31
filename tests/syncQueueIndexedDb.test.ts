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

const createLegacyDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open('criativa-field-ops-sync', 1);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('queued-visits', { keyPath: 'visitId' });
  };
  request.onsuccess = () => {
    const database = request.result;
    const transaction = database.transaction('queued-visits', 'readwrite');
    transaction.objectStore('queued-visits').put({
      visitId: 'VISIT-LEGACY',
      payload: {
        user: { id: 'promotor-a' },
        currentStore: 'Loja Antiga',
        photos: { checkout: ['base64-preservado'] },
      },
      status: 'pending',
      error: null,
      attempts: 0,
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T10:00:00.000Z',
    });
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  };
});

await createLegacyDatabase();
const queue = await import('../src/services/syncQueue.ts');

test('migra fila antiga para indice leve sem perder fotos', async () => {
  const summaries = await queue.listQueuedVisitSummaries('promotor-a');
  assert.deepEqual(summaries.map((item) => item.visitId), ['VISIT-LEGACY']);
  assert.equal(summaries[0].store, 'Loja Antiga');
  assert.equal('payload' in summaries[0], false);

  const fullVisit = await queue.getQueuedVisit('promotor-a', 'VISIT-LEGACY');
  assert.equal(fullVisit?.payload.photos.checkout[0], 'base64-preservado');
});

test('atualiza e remove somente a visita selecionada', async () => {
  await queue.upsertQueuedVisit('promotor-a', {
    user: { id: 'promotor-a' },
    currentStore: 'Loja Nova',
    photos: { checkout: ['segunda-foto'] },
  }, 'VISIT-NEW');

  assert.equal(await queue.getQueuedVisitCount('promotor-a'), 2);
  await queue.updateQueuedVisit('promotor-a', 'VISIT-LEGACY', { status: 'syncing' });

  const legacy = await queue.getQueuedVisit('promotor-a', 'VISIT-LEGACY');
  const created = await queue.getQueuedVisit('promotor-a', 'VISIT-NEW');
  assert.equal(legacy?.status, 'syncing');
  assert.equal(legacy?.payload.photos.checkout[0], 'base64-preservado');
  assert.equal(created?.payload.photos.checkout[0], 'segunda-foto');

  await queue.removeQueuedVisit('promotor-a', 'VISIT-LEGACY');
  assert.equal(await queue.getQueuedVisitCount('promotor-a'), 1);
  assert.equal(await queue.getQueuedVisit('promotor-a', 'VISIT-LEGACY'), null);
  assert.equal((await queue.getQueuedVisit('promotor-a', 'VISIT-NEW'))?.visitId, 'VISIT-NEW');
});
