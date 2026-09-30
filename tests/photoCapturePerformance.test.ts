import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('captura impede compressoes simultaneas e libera o canvas', async () => {
  const contentArea = await readSource('../src/components/ContentArea.tsx');
  const imageCompression = await readSource('../src/services/imageCompression.ts');

  assert.match(contentArea, /if \(photoProcessingRef\.current\) return/);
  assert.match(contentArea, /photoProcessingRef\.current = true/);
  assert.match(contentArea, /finally \{[\s\S]*?photoProcessingRef\.current = false/);
  assert.match(contentArea, /canvas\.width = 1;[\s\S]*?canvas\.height = 1/);
  assert.match(contentArea, /drawPhotoInPortrait\(ctx, img, layout\);[\s\S]*?releaseSourceImage\(\);/);
  assert.match(imageCompression, /finally \{[\s\S]*?releaseTemporaryCanvas\(lastCanvas, sourceCanvas\)/);
});

test('seletores podem recapturar e miniaturas usam decodificacao assincrona', async () => {
  const contentArea = await readSource('../src/components/ContentArea.tsx');
  const fileInputs = contentArea.match(/type="file"/g) || [];
  const clearedInputs = contentArea.match(/e\.currentTarget\.value = ''/g) || [];
  const allPhotoPreviews = contentArea.match(/<img /g) || [];
  const photoPreviews = contentArea.match(/<img loading="lazy" decoding="async"/g) || [];

  assert.equal(clearedInputs.length, fileInputs.length);
  assert.equal(photoPreviews.length, allPhotoPreviews.length);
  assert.match(contentArea, /disabled=\{isProcessingPhoto/);
});

test('galerias limitam miniaturas montadas e supervisor carrega sob demanda', async () => {
  const contentArea = await readSource('../src/components/ContentArea.tsx');

  assert.match(contentArea, /getPhotoPreviewPage\(photos, requestedPage\)/);
  assert.doesNotMatch(contentArea, /currentPhotos\.map\(/);
  assert.doesNotMatch(contentArea, /estoquePhotos\.map\(/);
  assert.doesNotMatch(contentArea, /returnsPhotos\.map\(/);
  assert.match(contentArea, /React\.lazy\(\(\) => import\('\.\/SupervisorDashboard'\)\)/);
  assert.match(contentArea, /<React\.Suspense/);
});
