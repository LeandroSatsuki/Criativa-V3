import assert from 'node:assert/strict';
import test from 'node:test';
import { getPhotoPreviewPage, PHOTO_PREVIEW_PAGE_SIZE } from '../src/services/photoGallery.ts';

test('galeria monta no maximo seis miniaturas e abre nas fotos recentes', () => {
  const photos = Array.from({ length: 30 }, (_, index) => `foto-${index}`);
  const preview = getPhotoPreviewPage(photos, Number.POSITIVE_INFINITY);

  assert.equal(PHOTO_PREVIEW_PAGE_SIZE, 6);
  assert.equal(preview.totalPages, 5);
  assert.equal(preview.items.length, 6);
  assert.deepEqual(preview.items.map((item) => item.photo), photos.slice(24));
});

test('galeria preserva o indice original ao navegar pelas fotos anteriores', () => {
  const photos = Array.from({ length: 14 }, (_, index) => `foto-${index}`);
  const preview = getPhotoPreviewPage(photos, 1);

  assert.deepEqual(preview.items.map((item) => item.originalIndex), [6, 7, 8, 9, 10, 11]);
  assert.deepEqual(preview.items.map((item) => item.photo), photos.slice(6, 12));
});
