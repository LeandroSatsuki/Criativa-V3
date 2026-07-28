import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPhotoLongEdgeCandidates,
  PHOTO_INITIAL_MAX_LONG_EDGE,
  PHOTO_MAX_BYTES,
  PHOTO_TARGET_BYTES,
} from '../src/services/imageCompression.ts';

test('define alvo menor que o teto e preserva resolução inicial de relatório', () => {
  assert.equal(PHOTO_TARGET_BYTES, 100 * 1024);
  assert.equal(PHOTO_MAX_BYTES, 120 * 1024);
  assert.equal(PHOTO_INITIAL_MAX_LONG_EDGE, 1280);
  assert.ok(PHOTO_TARGET_BYTES < PHOTO_MAX_BYTES);
});

test('reduz resolução de forma progressiva somente quando necessário', () => {
  assert.deepEqual(
    buildPhotoLongEdgeCandidates(1280),
    [1280, 1152, 1024, 960, 896, 800],
  );
  assert.deepEqual(buildPhotoLongEdgeCandidates(900), [900, 896, 800]);
  assert.deepEqual(buildPhotoLongEdgeCandidates(720), [720]);
});
