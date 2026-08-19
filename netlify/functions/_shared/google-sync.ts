import { getEnv } from './env.ts';
import { getBrasiliaISO } from './time.ts';
import { saveVisit, type VisitRecord } from './visits.ts';
import {
  buildMakePhotoBatches,
  buildMakePhotoEvents,
  buildMakeVisitFinalizeEvent,
  MAKE_CONTRACT_VERSION,
  MAKE_MAX_PHOTOS_PER_BATCH,
  validatePhotoBatchUploadResponse,
  validateVisitFinalizeResponse,
  type DrivePhotoReceipt,
  type DriveSyncManifest,
  type MakePhotoBatchEvent,
} from './make-contract-v2.ts';
import { buildGooglePhotoBatchIngress } from './google-contract.ts';

type GoogleSyncResult = {
  visitId: string;
  syncStatus: VisitRecord['syncStatus'];
  syncError?: string | null;
  progress?: { sent: number; total: number };
};

type GoogleSyncState = {
  pendingBatchId?: string;
  pendingFinalizeId?: string;
};

const createManifest = (visit: VisitRecord, totalPhotos: number): DriveSyncManifest => ({
  contractVersion: MAKE_CONTRACT_VERSION,
  totalPhotos,
  photos: visit.payload?.driveSync?.contractVersion === MAKE_CONTRACT_VERSION
    ? { ...(visit.payload.driveSync.photos || {}) }
    : {},
  folderId: visit.payload?.driveSync?.folderId,
  folderUrl: visit.payload?.driveSync?.folderUrl,
  finalizedAt: visit.payload?.driveSync?.finalizedAt,
  rowAction: visit.payload?.driveSync?.rowAction,
  rowId: visit.payload?.driveSync?.rowId,
});

const getBatchSize = () => {
  const configured = Number(getEnv('BACKEND_GOOGLE_PHOTO_BATCH_SIZE') || MAKE_MAX_PHOTOS_PER_BATCH);
  return Number.isInteger(configured) && configured >= 1 && configured <= MAKE_MAX_PHOTOS_PER_BATCH
    ? configured
    : MAKE_MAX_PHOTOS_PER_BATCH;
};

export const requestGoogle = async (path: string, init: RequestInit = {}) => {
  const baseUrl = getEnv('BACKEND_GOOGLE_SYNC_URL').replace(/\/$/, '');
  const token = getEnv('BACKEND_GOOGLE_SYNC_TOKEN');
  if (!baseUrl || !token) throw new Error('Google Sync nao configurado.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Ingress-Token': token,
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Google Sync retornou HTTP ${response.status}.`);
    return body as Record<string, any>;
  } finally {
    clearTimeout(timeout);
  }
};

const validateReceipts = (receipts: unknown, batch: MakePhotoBatchEvent) =>
  validatePhotoBatchUploadResponse(JSON.stringify({
    success: true,
    eventType: 'PHOTO_BATCH_UPLOADED',
    eventId: batch.EVENT_ID,
    batchId: batch.BATCH_ID,
    receipts,
  }), batch);

const applyReceipts = (manifest: DriveSyncManifest, receipts: DrivePhotoReceipt[]) => {
  const photos = { ...manifest.photos };
  receipts.forEach((receipt) => { photos[receipt.photoId] = receipt; });
  const first = receipts[0];
  return {
    ...manifest,
    folderId: manifest.folderId || first?.pdvFolderId || first?.folderId,
    folderUrl: manifest.folderUrl || first?.pdvFolderUrl || first?.folderUrl,
    photos,
  };
};

export const syncVisitRecordGoogle = async (visit: VisitRecord): Promise<GoogleSyncResult> => {
  const events = buildMakePhotoEvents(visit.payload);
  let manifest = createManifest(visit, events.length);
  let googleSync: GoogleSyncState = { ...(visit.payload?.googleSync || {}) };
  let current = await saveVisit({
    ...visit,
    syncStatus: 'enviando',
    syncError: null,
    payload: { ...visit.payload, driveSync: manifest, googleSync },
    updatedAt: getBrasiliaISO(),
  });

  try {
    const pendingEvents = events.filter((event) => !manifest.photos[event.ID_FOTO]);
    if (pendingEvents.length) {
      const batch = buildMakePhotoBatches(pendingEvents, getBatchSize())[0];
      let response: Record<string, any>;
      if (googleSync.pendingBatchId) {
        response = await requestGoogle(`/v1/ingress/jobs/${encodeURIComponent(googleSync.pendingBatchId)}`);
        if (response.state === 'dead_letter') throw new Error('Lote Google excedeu o limite de tentativas.');
        if (response.state !== 'completed') {
          return { visitId: current.visitId, syncStatus: 'enviando', progress: {
            sent: Object.keys(manifest.photos).length, total: events.length,
          } };
        }
        response = { ...response, receipts: response.receipt };
      } else {
        response = await requestGoogle('/v1/ingress/photo-batch', {
          method: 'POST',
          body: JSON.stringify(buildGooglePhotoBatchIngress(batch)),
        });
        if (response.state !== 'completed') {
          googleSync = { ...googleSync, pendingBatchId: batch.BATCH_ID };
          await saveVisit({
            ...current,
            payload: { ...current.payload, driveSync: manifest, googleSync },
            updatedAt: getBrasiliaISO(),
          });
          return { visitId: current.visitId, syncStatus: 'enviando', progress: {
            sent: Object.keys(manifest.photos).length, total: events.length,
          } };
        }
      }

      manifest = applyReceipts(manifest, validateReceipts(response.receipts, batch));
      googleSync = { ...googleSync, pendingBatchId: undefined };
      current = await saveVisit({
        ...current,
        payload: { ...current.payload, driveSync: manifest, googleSync },
        updatedAt: getBrasiliaISO(),
      });
    }

    const sent = Object.keys(manifest.photos).length;
    if (sent < events.length) {
      return { visitId: current.visitId, syncStatus: 'enviando', progress: { sent, total: events.length } };
    }

    if (!manifest.finalizedAt) {
      const finalizeEvent = buildMakeVisitFinalizeEvent(current.payload, events, manifest);
      let response: Record<string, any>;
      if (googleSync.pendingFinalizeId) {
        response = await requestGoogle(`/v1/ingress/jobs/${encodeURIComponent(googleSync.pendingFinalizeId)}`);
        if (response.state === 'dead_letter') throw new Error('Finalizacao Google excedeu o limite de tentativas.');
        if (response.state !== 'completed') {
          return { visitId: current.visitId, syncStatus: 'enviando', progress: { sent, total: events.length } };
        }
        response = { ...response, ...(response.receipt || {}) };
      } else {
        response = await requestGoogle('/v1/ingress/finalize', {
          method: 'POST',
          body: JSON.stringify({
            eventType: 'VISIT_FINALIZE',
            eventId: finalizeEvent.EVENT_ID,
            idempotencyKey: finalizeEvent.IDEMPOTENCY_KEY,
            visitId: finalizeEvent.ID_VISITA,
            row: finalizeEvent,
          }),
        });
        if (response.state !== 'completed') {
          googleSync = { ...googleSync, pendingFinalizeId: finalizeEvent.IDEMPOTENCY_KEY };
          await saveVisit({
            ...current,
            payload: { ...current.payload, driveSync: manifest, googleSync },
            updatedAt: getBrasiliaISO(),
          });
          return { visitId: current.visitId, syncStatus: 'enviando', progress: { sent, total: events.length } };
        }
      }

      const confirmation = validateVisitFinalizeResponse(JSON.stringify({
        success: true,
        eventType: 'VISIT_FINALIZED',
        eventId: finalizeEvent.EVENT_ID,
        visitId: finalizeEvent.ID_VISITA,
        rowAction: response.rowAction,
        rowId: response.rowId,
      }), finalizeEvent);
      manifest = {
        ...manifest,
        finalizedAt: getBrasiliaISO(),
        rowAction: confirmation.rowAction,
        rowId: confirmation.rowId,
      };
      googleSync = { ...googleSync, pendingFinalizeId: undefined };
    }

    const completed = await saveVisit({
      ...current,
      syncStatus: 'enviado',
      syncError: null,
      payload: { ...current.payload, driveSync: manifest, googleSync },
      makeResponse: {
        status: 200,
        ok: true,
        body: JSON.stringify({ provider: 'google-v1', photos: events.length, rowAction: manifest.rowAction }),
      },
      updatedAt: getBrasiliaISO(),
    });
    return { visitId: completed.visitId, syncStatus: 'enviado', syncError: null, progress: {
      sent: events.length, total: events.length,
    } };
  } catch (error: any) {
    const message = error?.name === 'AbortError'
      ? 'Tempo esgotado consultando o Google Sync; a visita permanece na fila.'
      : error?.message || 'Falha na sincronizacao Google.';
    console.error(JSON.stringify({
      event: 'visit_sync_failed', visitId: current.visitId, mode: 'google-v1',
      reason: error?.name === 'AbortError' ? 'timeout' : 'google_sync_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
    const errored = await saveVisit({
      ...current,
      syncStatus: 'erro',
      syncError: message,
      payload: { ...current.payload, driveSync: manifest, googleSync },
      updatedAt: getBrasiliaISO(),
    });
    return { visitId: errored.visitId, syncStatus: 'erro', syncError: errored.syncError, progress: {
      sent: Object.keys(manifest.photos).length, total: events.length,
    } };
  }
};
