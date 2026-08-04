import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPhotoLongEdgeCandidates,
  PHOTO_INITIAL_MAX_LONG_EDGE,
  PHOTO_MAX_BYTES,
  PHOTO_TARGET_BYTES,
} from '../src/services/imageCompression.ts';

test('define alvo menor que o teto e reduz a resolução inicial em 35 por cento', () => {
  assert.equal(PHOTO_TARGET_BYTES, 100 * 1024);
  assert.equal(PHOTO_MAX_BYTES, 120 * 1024);
  assert.equal(PHOTO_INITIAL_MAX_LONG_EDGE, 832);
  assert.ok(PHOTO_TARGET_BYTES < PHOTO_MAX_BYTES);
});

test('reduz resolução de forma progressiva somente quando necessário', () => {
  assert.deepEqual(
    buildPhotoLongEdgeCandidates(832),
    [832, 749, 666, 624, 582, 520],
  );
  assert.deepEqual(buildPhotoLongEdgeCandidates(700), [700, 666, 624, 582, 520]);
  assert.deepEqual(buildPhotoLongEdgeCandidates(500), [500]);
});
