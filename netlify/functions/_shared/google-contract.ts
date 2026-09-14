import type { MakePhotoBatchEvent } from './make-contract-v2.ts';

export const buildGooglePhotoBatchIngress = (batch: MakePhotoBatchEvent) => ({
  eventType: 'PHOTO_UPLOAD_BATCH' as const,
  eventId: batch.EVENT_ID,
  batchId: batch.BATCH_ID,
  photos: batch.PHOTOS.map((photo) => ({
    eventId: photo.EVENT_ID,
    idempotencyKey: photo.IDEMPOTENCY_KEY,
    visitId: batch.ID_VISITA,
    photoId: photo.ID_FOTO,
    stage: photo.ETAPA,
    industry: photo.INDUSTRIA,
    order: photo.ORDEM,
    fileName: photo.NOME_ARQUIVO,
    mimeType: photo.MIME_TYPE,
    industryFolderName: batch.PASTA_INDUSTRIA_NOME,
    visitFolderName: batch.PASTA_VISITA_NOME,
    pdvFolderName: batch.PASTA_PDV_NOME,
    subfolderName: batch.PASTA_SUBPASTA_NOME,
    base64: photo.FOTO_BASE64,
  })),
});
