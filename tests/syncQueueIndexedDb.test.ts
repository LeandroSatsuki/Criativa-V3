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
    const store = transaction.objectStore('queued-visits');
    for (let index = 0; index < 4; index += 1) {
      store.put({
        visitId: index === 0 ? 'VISIT-LEGACY' : `VISIT-LEGACY-${index}`,
        payload: {
          user: { id: 'promotor-a' },
          currentStore: index === 0 ? 'Loja Antiga' : `Loja Antiga ${index}`,
          photos: { checkout: [`base64-preservado-${index}${'x'.repeat(250_000)}`] },
        },
        status: 'pending',
        error: null,
        attempts: 0,
        createdAt: `2026-08-30T10:00:0${index}.000Z`,
        updatedAt: `2026-08-30T10:00:0${index}.000Z`,
      });
    }
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
  assert.equal(summaries.length, 4);
  assert.deepEqual(summaries.map((item) => item.visitId), [
    'VISIT-LEGACY-3',
    'VISIT-LEGACY-2',
    'VISIT-LEGACY-1',
    'VISIT-LEGACY',
  ]);
  assert.equal(summaries[3].store, 'Loja Antiga');
  assert.equal('payload' in summaries[0], false);

  const fullVisit = await queue.getQueuedVisit('promotor-a', 'VISIT-LEGACY');
  assert.match(fullVisit?.payload.photos.checkout[0], /^base64-preservado-0x+$/);
});

test('atualiza e remove somente a visita selecionada', async () => {
  await queue.upsertQueuedVisit('promotor-a', {
    user: { id: 'promotor-a' },
    currentStore: 'Loja Nova',
    photos: { checkout: ['segunda-foto'] },
  }, 'VISIT-NEW');

  assert.equal(await queue.getQueuedVisitCount('promotor-a'), 5);
  await queue.updateQueuedVisit('promotor-a', 'VISIT-LEGACY', { status: 'syncing' });

  const legacy = await queue.getQueuedVisit('promotor-a', 'VISIT-LEGACY');
  const created = await queue.getQueuedVisit('promotor-a', 'VISIT-NEW');
  assert.equal(legacy?.status, 'syncing');
  assert.match(legacy?.payload.photos.checkout[0], /^base64-preservado-0x+$/);
  assert.equal(created?.payload.photos.checkout[0], 'segunda-foto');

  await queue.removeQueuedVisit('promotor-a', 'VISIT-LEGACY');
  assert.equal(await queue.getQueuedVisitCount('promotor-a'), 4);
  assert.equal(await queue.getQueuedVisit('promotor-a', 'VISIT-LEGACY'), null);
  assert.equal((await queue.getQueuedVisit('promotor-a', 'VISIT-NEW'))?.visitId, 'VISIT-NEW');
});
