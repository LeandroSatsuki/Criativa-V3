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
  }));
  await Promise.all(saves);

  const restored = await storage.loadVisitDraft('draft-test') as any;
  assert.equal(restored.sequence, 3);
  assert.equal(restored.photos.checkout[0], 'foto-3');

  const compatibility = JSON.parse(memoryStorage.get('draft-test') || '{}');
  assert.deepEqual(compatibility.photos.checkout, []);
});
