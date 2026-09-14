import assert from 'node:assert/strict';
import test from 'node:test';
import type { PhotoBatchIngress, PhotoReceipt } from '../src/contracts.ts';
import { SyncIngress } from '../src/ingress.ts';
import type { SyncJob } from '../src/idempotency.ts';

const input: PhotoBatchIngress = {
  eventType: 'PHOTO_UPLOAD_BATCH',
  eventId: 'batch-event-1',
  batchId: 'batch-1',
  photos: [{
    eventId: 'photo-event-1',
    idempotencyKey: 'photo-1',
    visitId: 'visit-1',
    photoId: 'photo-1',
    stage: 'ANTES',
    industry: 'VENEZA',
    order: 1,
    fileName: 'foto.jpg',
    mimeType: 'image/jpeg',
    industryFolderName: 'VENEZA',
    visitFolderName: '19-08-2026',
    pdvFolderName: 'Loja',
    subfolderName: '',
    base64: Buffer.from('foto').toString('base64'),
  }],
};

test('ingresso grava foto opaca e enfileira somente referencia', async () => {
  const objects = new Map<string, Buffer>();
  let queued: any;
  const ingress = new SyncIngress(
    { get: async () => undefined },
    {
      write: async (name, content) => { objects.set(name, content); },
      remove: async (name) => { objects.delete(name); },
    },
    {
      publishPhotoBatch: async (job) => { queued = job; },
      publishFinalize: async () => {},
    },
  );

  const result = await ingress.acceptPhotoBatch(input);

  assert.equal(result.state, 'queued');
  assert.equal(objects.size, 1);
  assert.match(queued.photos[0].objectName, /^staging\/[a-f0-9]{24}\/[a-f0-9]{64}\.jpg$/);
  assert.equal('base64' in queued.photos[0], false);
});

test('retry concluido devolve recibo sem regravar staging ou criar tarefa', async () => {
  const receipt = [{ photoId: 'photo-1' }] as PhotoReceipt[];
  let writes = 0;
  let tasks = 0;
  const completed: SyncJob<PhotoReceipt[]> = {
    id: input.batchId,
    state: 'completed',
    attempts: 1,
    receipt,
  };
  const ingress = new SyncIngress(
    { get: async <T>() => completed as SyncJob<T> },
    {
      write: async () => { writes += 1; },
      remove: async () => {},
    },
    {
      publishPhotoBatch: async () => { tasks += 1; },
      publishFinalize: async () => {},
    },
  );

  const result = await ingress.acceptPhotoBatch(input);

  assert.equal(result.state, 'completed');
  assert.deepEqual(result.receipts, receipt);
  assert.equal(writes, 0);
  assert.equal(tasks, 0);
});

test('rejeita lote acima de 20 fotos antes de gravar objetos', async () => {
  let writes = 0;
  const ingress = new SyncIngress(
    { get: async () => undefined },
    {
      write: async () => { writes += 1; },
      remove: async () => {},
    },
    { publishPhotoBatch: async () => {}, publishFinalize: async () => {} },
  );

  await assert.rejects(
    () => ingress.acceptPhotoBatch({ ...input, photos: Array(21).fill(input.photos[0]) }),
    /entre 1 e 20/,
  );
  assert.equal(writes, 0);
});

test('consulta de status retorna recibo somente quando concluido', async () => {
  const receipt = [{ photoId: 'photo-1' }] as PhotoReceipt[];
  const ingress = new SyncIngress(
    { get: async <T>() => ({ id: 'batch-1', state: 'completed', attempts: 1, receipt }) as SyncJob<T> },
    { write: async () => {}, remove: async () => {} },
    { publishPhotoBatch: async () => {}, publishFinalize: async () => {} },
  );

  const result = await ingress.getStatus('batch-1');

  assert.equal(result.state, 'completed');
  assert.deepEqual(result.receipt, receipt);
});
