import type { PhotoBatchJob, PhotoReceipt, VisitFinalizeJob } from './contracts.js';
import type { DriveWriter } from './drive.js';
import type { JobRepository } from './jobs.js';
import type { SheetsWriter } from './sheets.js';

export type PhotoObjectStore = {
  read(objectName: string): Promise<Buffer>;
  remove(objectName: string): Promise<void>;
};

export class SyncWorker {
  constructor(
    private readonly jobs: JobRepository,
    private readonly objects: PhotoObjectStore,
    private readonly drive: DriveWriter,
    private readonly sheets: SheetsWriter,
  ) {}

  async processPhotoBatch(batch: PhotoBatchJob) {
    if (!batch.batchId || batch.photos.length < 1 || batch.photos.length > 20) {
      throw new Error('Lote deve conter entre 1 e 20 fotos.');
    }
    const claim = await this.jobs.claim<PhotoReceipt[]>(batch.batchId, new Date());
    if (claim.action === 'completed') return claim.job.receipt || [];
    if (claim.action === 'leased') throw new Error('Lote ja esta em processamento.');
    if (claim.action === 'dead_letter') throw new Error('Lote excedeu o limite de tentativas.');

    try {
      const receipts: PhotoReceipt[] = [];
      for (const photo of batch.photos) {
        const content = await this.objects.read(photo.objectName);
        const receipt = await this.drive.upload(photo, content);
        receipts.push(receipt);
      }
      await this.jobs.complete(claim.job, receipts);
      await Promise.allSettled(batch.photos.map((photo) => this.objects.remove(photo.objectName)));
      return receipts;
    } catch (error) {
      await this.jobs.fail(claim.job, error);
      throw error;
    }
  }

  async finalizeVisit(event: VisitFinalizeJob) {
    const claim = await this.jobs.claim<{ rowAction: 'created' | 'updated'; rowId: string }>(
      event.idempotencyKey,
      new Date(),
    );
    if (claim.action === 'completed') return claim.job.receipt;
    if (claim.action === 'leased') throw new Error('Visita ja esta em finalizacao.');
    if (claim.action === 'dead_letter') throw new Error('Finalizacao excedeu o limite de tentativas.');

    try {
      if (event.row.ID_VISITA !== event.visitId) throw new Error('ID_VISITA divergente.');
      const receipt = await this.sheets.upsert(event.row);
      await this.jobs.complete(claim.job, receipt);
      return receipt;
    } catch (error) {
      await this.jobs.fail(claim.job, error);
      throw error;
    }
  }
}
