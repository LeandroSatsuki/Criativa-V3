import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGooglePhotoBatchIngress } from '../netlify/functions/_shared/google-contract.ts';
import { buildMakePhotoBatches, buildMakePhotoEvents } from '../netlify/functions/_shared/make-contract-v2.ts';
import { getBackgroundPollDelayMs } from '../netlify/functions/_shared/sync-provider.ts';

test('adapta lote Make para ingresso Google sem alterar IDs e pastas', () => {
  const events = buildMakePhotoEvents({
    visitId: 'visit-google-1',
    timestamp: '2026-08-19T10:00:00-03:00',
    currentStore: 'Loja Teste',
    user: { name: 'Promotor' },
    selectedIndustry: 'Veneza',
    photos: { ANTES: [Buffer.from('foto').toString('base64')] },
  });
  const batch = buildMakePhotoBatches(events, 20)[0];

  const ingress = buildGooglePhotoBatchIngress(batch);

  assert.equal(ingress.batchId, batch.BATCH_ID);
  assert.equal(ingress.photos[0].photoId, batch.PHOTOS[0].ID_FOTO);
  assert.equal(ingress.photos[0].industryFolderName, 'Veneza');
  assert.equal(ingress.photos[0].pdvFolderName, 'Loja Teste');
  assert.equal(ingress.photos[0].base64, batch.PHOTOS[0].FOTO_BASE64);
});

test('aguarda entre consultas apenas no provedor Google', () => {
  assert.equal(getBackgroundPollDelayMs('google-v1'), 2_000);
  assert.equal(getBackgroundPollDelayMs(' GOOGLE-V1 '), 2_000);
  assert.equal(getBackgroundPollDelayMs('make'), 0);
  assert.equal(getBackgroundPollDelayMs(undefined), 0);
});
