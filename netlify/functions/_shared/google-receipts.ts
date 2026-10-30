import {
  buildMakePhotoBatches,
  MAKE_MAX_PHOTOS_PER_BATCH,
  validatePhotoBatchUploadResponse,
  type DrivePhotoReceipt,
  type MakePhotoBatchEvent,
  type MakePhotoEvent,
} from './make-contract-v2.ts';

type ResolveGoogleReceiptsOptions = {
  visitId: string;
  jobId: string;
  pendingEvents: MakePhotoEvent[];
  pendingPhotoIds?: string[];
  receipts: unknown;
};

const invalidReceiptError = () => new Error('Google nao confirmou todas as fotos do lote no Google Drive.');

const buildExactBatch = (events: MakePhotoEvent[], jobId: string): MakePhotoBatchEvent => {
  const batches = buildMakePhotoBatches(events, MAKE_MAX_PHOTOS_PER_BATCH);
  const batch = batches[0];
  if (!batch || batches.length !== 1 || batch.PHOTOS.length !== events.length) throw invalidReceiptError();
  return { ...batch, EVENT_ID: jobId, BATCH_ID: jobId };
};

export const getPendingBatchEvents = (
  pendingEvents: MakePhotoEvent[],
  pendingPhotoIds?: string[],
) => {
  if (!pendingPhotoIds?.length) return null;
  if (pendingPhotoIds.length > MAKE_MAX_PHOTOS_PER_BATCH) throw invalidReceiptError();

  const uniqueIds = new Set(pendingPhotoIds);
  if (uniqueIds.size !== pendingPhotoIds.length) throw invalidReceiptError();
  const byId = new Map(pendingEvents.map((event) => [event.ID_FOTO, event]));
  const events = pendingPhotoIds.map((photoId) => byId.get(photoId));
  if (events.some((event) => !event)) throw invalidReceiptError();
  return events as MakePhotoEvent[];
};

export const resolveGooglePhotoReceipts = ({
  visitId,
  jobId,
  pendingEvents,
  pendingPhotoIds,
  receipts,
}: ResolveGoogleReceiptsOptions): { batch: MakePhotoBatchEvent; receipts: DrivePhotoReceipt[] } => {
  if (!jobId.startsWith(`${visitId}:BATCH:`) || !Array.isArray(receipts)) throw invalidReceiptError();
  if (!receipts.length || receipts.length > MAKE_MAX_PHOTOS_PER_BATCH) throw invalidReceiptError();

  const receiptIds = receipts.map((receipt: any) => String(receipt?.photoId || ''));
  if (receiptIds.some((photoId) => !photoId) || new Set(receiptIds).size !== receiptIds.length) {
    throw invalidReceiptError();
  }

  const expectedIds = pendingPhotoIds?.length ? pendingPhotoIds : receiptIds;
  const expectedEvents = getPendingBatchEvents(pendingEvents, expectedIds);
  if (!expectedEvents || expectedEvents.length !== receipts.length) throw invalidReceiptError();
  const expectedIdSet = new Set(expectedIds);
  if (receiptIds.some((photoId) => !expectedIdSet.has(photoId))) throw invalidReceiptError();

  const expectedByPhotoId = new Map(expectedEvents.map((event) => [event.ID_FOTO, event]));
  receipts.forEach((receipt: any) => {
    const event = expectedByPhotoId.get(String(receipt.photoId));
    if (!event || (receipt.eventId && String(receipt.eventId) !== event.EVENT_ID)) throw invalidReceiptError();
  });

  const batch = buildExactBatch(expectedEvents, jobId);
  try {
    return {
      batch,
      receipts: validatePhotoBatchUploadResponse(JSON.stringify({
        success: true,
        eventType: 'PHOTO_BATCH_UPLOADED',
        eventId: batch.EVENT_ID,
        batchId: batch.BATCH_ID,
        receipts,
      }), batch),
    };
  } catch {
    throw invalidReceiptError();
  }
};
