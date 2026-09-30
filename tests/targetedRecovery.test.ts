import assert from 'node:assert/strict';
import test from 'node:test';
import { canRecoverTargetedVisit, hashPhotoIds } from '../netlify/functions/_shared/targeted-recovery.ts';

const photoIds = Array.from({ length: 46 }, (_, index) => `test-photo-${index}`);
const visit = {
  visitId: 'VISIT-62A55D5A',
  syncStatus: 'erro',
  syncError: 'Make retornou HTTP 400: Queue is full.',
  payload: {
    user: { id: '80' },
    currentStoreId: '147',
    driveSync: { totalPhotos: 46 },
  },
} as any;

test('targeted recovery rejects mismatched records and photo sets', () => {
  assert.equal(hashPhotoIds(['b', 'a']), hashPhotoIds(['a', 'b']));
  assert.notEqual(hashPhotoIds(['a', 'b']), hashPhotoIds(['a', 'c']));
  assert.equal(canRecoverTargetedVisit(visit, photoIds), false);
  assert.equal(canRecoverTargetedVisit({ ...visit, visitId: 'VISIT-OTHER' }, photoIds), false);
  assert.equal(canRecoverTargetedVisit({ ...visit, syncStatus: 'enviado' }, photoIds), false);
  assert.equal(canRecoverTargetedVisit(visit, photoIds.slice(1)), false);
  assert.equal(canRecoverTargetedVisit(visit, [...photoIds.slice(1), 'changed']), false);
});
