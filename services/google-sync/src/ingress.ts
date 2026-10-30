import type {
  PhotoBatchIngress,
  PhotoBatchJob,
  PhotoReceipt,
  StagedPhoto,
  VisitFinalizeJob,
} from './contracts.js';
import { stagingObjectName, type SyncJob } from './idempotency.js';
import type { TaskPublisher } from './tasks.js';

const MAX_PHOTOS = 20;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_BATCH_BYTES = 30 * 1024 * 1024;

export type IngressObjectStore = {
  write(objectName: string, content: Buffer, mimeType: string): Promise<void>;
  remove(objectName: string): Promise<void>;
};

export type IngressJobReader = {
  get<T>(id: string): Promise<SyncJob<T> | undefined>;
};

const requiredText = (value: unknown, field: string) => {
  const text = String(value || '').trim();
  if (!text) throw new Error(`Campo obrigatorio ausente: ${field}`);
  return text;
};

const decodePhoto = (value: string) => {
  const normalized = value.replace(/^data:image\/jpeg;base64,/, '').replace(/\s+/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error('Foto base64 invalida.');
  }
  const content = Buffer.from(normalized, 'base64');
  if (!content.length || content.length > MAX_PHOTO_BYTES) {
    throw new Error('Foto fora do limite de tamanho.');
  }
  return content;
};

export class SyncIngress {
  constructor(
    private readonly jobs: IngressJobReader,
    private readonly objects: IngressObjectStore,
    private readonly tasks: TaskPublisher,
  ) {}

  async getStatus(id: string) {
    const jobId = requiredText(id, 'id');
    const job = await this.jobs.get<unknown>(jobId);
    if (!job) return { state: 'pending' as const, id: jobId };
    if (job.state === 'completed') {
      return { state: 'completed' as const, id: jobId, receipt: job.receipt };
    }
    if (job.state === 'dead_letter') {
      return { state: 'dead_letter' as const, id: jobId, attempts: job.attempts };
    }
    return { state: 'processing' as const, id: jobId, attempts: job.attempts };
  }

  private async completed<T>(id: string) {
    const job = await this.jobs.get<T>(id);
    if (job?.state === 'completed') return job.receipt;
    if (job?.state === 'dead_letter') throw new Error('Evento excedeu o limite de tentativas.');
    return undefined;
  }

  async acceptPhotoBatch(input: PhotoBatchIngress) {
    const batchId = requiredText(input?.batchId, 'batchId');
    const eventId = requiredText(input?.eventId, 'eventId');
    if (input?.eventType !== 'PHOTO_UPLOAD_BATCH') throw new Error('Tipo de evento invalido.');
    if (!Array.isArray(input.photos) || input.photos.length < 1 || input.photos.length > MAX_PHOTOS) {
      throw new Error('Lote deve conter entre 1 e 20 fotos.');
    }

    const receipt = await this.completed<PhotoReceipt[]>(batchId);
    if (receipt) return { state: 'completed' as const, eventId, batchId, receipts: receipt };

    let totalBytes = 0;
    const staged: StagedPhoto[] = [];
    for (const photo of input.photos) {
      if (photo.mimeType !== 'image/jpeg') throw new Error('Tipo de foto nao permitido.');
      const visitId = requiredText(photo.visitId, 'visitId');
      const photoId = requiredText(photo.photoId, 'photoId');
      const content = decodePhoto(requiredText(photo.base64, 'base64'));
      totalBytes += content.length;
      if (totalBytes > MAX_BATCH_BYTES) throw new Error('Lote excede o limite total de tamanho.');
      const objectName = stagingObjectName(visitId, photoId);
      await this.objects.write(objectName, content, photo.mimeType);
      const { base64: _base64, ...metadata } = photo;
      staged.push({ ...metadata, visitId, photoId, objectName });
    }

    const completedAfterWrite = await this.completed<PhotoReceipt[]>(batchId);
    if (completedAfterWrite) {
      await Promise.allSettled(staged.map((photo) => this.objects.remove(photo.objectName)));
      return { state: 'completed' as const, eventId, batchId, receipts: completedAfterWrite };
    }

    const job: PhotoBatchJob = { eventType: 'PHOTO_UPLOAD_BATCH', eventId, batchId, photos: staged };
    await this.tasks.publishPhotoBatch(job);
    return { state: 'queued' as const, eventId, batchId };
  }

  async acceptFinalize(input: VisitFinalizeJob) {
    if (input?.eventType !== 'VISIT_FINALIZE') throw new Error('Tipo de evento invalido.');
    const idempotencyKey = requiredText(input.idempotencyKey, 'idempotencyKey');
    const receipt = await this.completed<{ rowAction: 'created' | 'updated'; rowId: string }>(idempotencyKey);
    if (receipt) return { state: 'completed' as const, eventId: input.eventId, ...receipt };
    await this.tasks.publishFinalize(input);
    return { state: 'queued' as const, eventId: input.eventId };
  }
}
