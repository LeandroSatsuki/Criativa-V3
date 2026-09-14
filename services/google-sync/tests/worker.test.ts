import assert from 'node:assert/strict';
import test from 'node:test';
import { claimJob, completeJob, failJob, type SyncJob } from '../src/idempotency.ts';
import type { JobRepository } from '../src/jobs.ts';
import { SyncWorker } from '../src/worker.ts';
import type { PhotoBatchJob } from '../src/contracts.ts';

class MemoryJobs implements JobRepository {
  jobs = new Map<string, SyncJob<any>>();
  async get<T>(id: string) { return this.jobs.get(id) as SyncJob<T> | undefined; }
  async claim<T>(id: string, now: Date) {
    const result = claimJob<T>(this.jobs.get(id) || { id, state: 'pending', attempts: 0 }, now, 60_000, 5);
    this.jobs.set(id, result.job);
    return result;
  }
  async complete<T>(job: SyncJob<T>, receipt: T) { this.jobs.set(job.id, completeJob(job, receipt)); }
  async fail<T>(job: SyncJob<T>, error: unknown) { this.jobs.set(job.id, failJob(job, error, 5)); }
}

const batch: PhotoBatchJob = {
  eventType: 'PHOTO_UPLOAD_BATCH',
  eventId: 'batch-1',
  batchId: 'batch-1',
  photos: [{
    eventId: 'photo-event-1', idempotencyKey: 'photo-1', visitId: 'visit-1', photoId: 'photo-1',
    stage: 'ANTES', industry: 'VENEZA', order: 1, fileName: 'foto.jpg', mimeType: 'image/jpeg',
    objectName: 'staging/visit/photo.jpg', industryFolderName: 'VENEZA', visitFolderName: '19-08-2026',
    pdvFolderName: 'Loja', subfolderName: '',
  }],
};

test('retry de lote concluido devolve recibo sem reler ou reenviar foto', async () => {
  const jobs = new MemoryJobs();
  let reads = 0;
  let uploads = 0;
  let removals = 0;
  const worker = new SyncWorker(
    jobs,
    { read: async () => { reads += 1; return Buffer.from('foto'); }, remove: async () => { removals += 1; } },
    { upload: async (photo) => { uploads += 1; return {
      eventId: photo.eventId, photoId: photo.photoId, stage: photo.stage, industry: photo.industry,
      order: photo.order, fileName: photo.fileName, fileId: 'file-1', fileUrl: 'file-url',
      folderId: 'folder-1', folderUrl: 'folder-url', pdvFolderId: 'pdv-1', pdvFolderUrl: 'pdv-url',
      syncedAt: new Date().toISOString(),
    }; } } as any,
    { upsert: async () => ({ rowAction: 'created', rowId: '2' }) } as any,
  );

  const first = await worker.processPhotoBatch(batch);
  const retry = await worker.processPhotoBatch(batch);

  assert.deepEqual(retry, first);
  assert.equal(reads, 1);
  assert.equal(uploads, 1);
  assert.equal(removals, 1);
});

test('falha parcial preserva todos os objetos de staging para o retry', async () => {
  const jobs = new MemoryJobs();
  let uploads = 0;
  let removals = 0;
  const twoPhotos: PhotoBatchJob = {
    ...batch,
    batchId: 'batch-partial-failure',
    photos: [
      batch.photos[0],
      {
        ...batch.photos[0],
        eventId: 'photo-event-2',
        idempotencyKey: 'photo-2',
        photoId: 'photo-2',
        fileName: 'foto-2.jpg',
        objectName: 'staging/visit/photo-2.jpg',
        order: 2,
      },
    ],
  };
  const worker = new SyncWorker(
    jobs,
    { read: async () => Buffer.from('foto'), remove: async () => { removals += 1; } },
    { upload: async () => {
      uploads += 1;
      if (uploads === 2) throw new Error('falha simulada no Drive');
      return {};
    } } as any,
    { upsert: async () => ({ rowAction: 'created', rowId: '2' }) } as any,
  );

  await assert.rejects(() => worker.processPhotoBatch(twoPhotos), /falha simulada/);
  assert.equal(removals, 0);
});

test('falha ao limpar staging nao transforma lote concluido em erro', async () => {
  const jobs = new MemoryJobs();
  const worker = new SyncWorker(
    jobs,
    { read: async () => Buffer.from('foto'), remove: async () => { throw new Error('falha no cleanup'); } },
    { upload: async (photo) => ({
      eventId: photo.eventId, photoId: photo.photoId, stage: photo.stage, industry: photo.industry,
      order: photo.order, fileName: photo.fileName, fileId: 'file-1', fileUrl: 'file-url',
      folderId: 'folder-1', folderUrl: 'folder-url', pdvFolderId: 'pdv-1', pdvFolderUrl: 'pdv-url',
      syncedAt: new Date().toISOString(),
    }) } as any,
    { upsert: async () => ({ rowAction: 'created', rowId: '2' }) } as any,
  );

  const receipts = await worker.processPhotoBatch({ ...batch, batchId: 'batch-cleanup-failure' });
  assert.equal(receipts.length, 1);
  assert.equal(jobs.jobs.get('batch-cleanup-failure')?.state, 'completed');
});
