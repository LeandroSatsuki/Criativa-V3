import { getEnv } from './env.ts';
import { getBrasiliaISO } from './time.ts';
import { saveVisit, type VisitRecord } from './visits.ts';
import {
  buildMakePhotoBatches,
  buildMakePhotoEvents,
  buildMakeVisitFinalizeEvent,
  MAKE_CONTRACT_VERSION,
  MAKE_MAX_PHOTOS_PER_BATCH,
  validateVisitFinalizeResponse,
  type DrivePhotoReceipt,
  type DriveSyncManifest,
} from './make-contract-v2.ts';
import { buildGooglePhotoBatchIngress } from './google-contract.ts';
import { getPendingBatchEvents, resolveGooglePhotoReceipts } from './google-receipts.ts';
import {
  buildGoogleRecoveryId,
  getGoogleManualRetryCount,
  getGoogleRetryState,
  type GoogleSyncRetryState,
} from './google-retry.ts';

export { getGoogleRetryState } from './google-retry.ts';

type GoogleSyncResult = {
  visitId: string;
  syncStatus: VisitRecord['syncStatus'];
  syncError?: string | null;
  progress?: { sent: number; total: number };
};

type GoogleSyncState = GoogleSyncRetryState;

type GoogleSyncOptions = {
  recoverDeadLetter?: boolean;
};

const GOOGLE_DEFAULT_PHOTOS_PER_BATCH = 10;
const GOOGLE_STALE_JOB_AGE_MS = 30 * 60 * 1000;

const hasStalePendingGoogleJob = (visit: VisitRecord, now = Date.now()) => {
  const googleSync = visit.payload?.googleSync || {};
  if (!googleSync.pendingBatchId && !googleSync.pendingFinalizeId) return false;
  const updatedAt = Date.parse(visit.updatedAt);
  return Number.isFinite(updatedAt) && now - updatedAt >= GOOGLE_STALE_JOB_AGE_MS;
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
  const configured = Number(getEnv('BACKEND_GOOGLE_PHOTO_BATCH_SIZE') || GOOGLE_DEFAULT_PHOTOS_PER_BATCH);
  return Number.isInteger(configured) && configured >= 1 && configured <= MAKE_MAX_PHOTOS_PER_BATCH
    ? configured
    : GOOGLE_DEFAULT_PHOTOS_PER_BATCH;
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

export const syncVisitRecordGoogle = async (
  visit: VisitRecord,
  options: GoogleSyncOptions = {},
): Promise<GoogleSyncResult> => {
  const stalePendingJobAtStart = hasStalePendingGoogleJob(visit);
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
      let batch = buildMakePhotoBatches(pendingEvents, getBatchSize())[0];
      let response: Record<string, any>;
      if (googleSync.pendingBatchId) {
        response = await requestGoogle(`/v1/ingress/jobs/${encodeURIComponent(googleSync.pendingBatchId)}`);
        if (response.state === 'dead_letter' || (options.recoverDeadLetter && stalePendingJobAtStart)) {
          if (!options.recoverDeadLetter) throw new Error('Lote Google excedeu o limite de tentativas.');

          const retryState = getGoogleRetryState(current);
          if (retryState.remaining === 0) {
            throw new Error('Lote Google requer suporte apos duas tentativas manuais.');
          }
          if (retryState.retryAfterSeconds > 0) {
            throw new Error(`Aguarde ${retryState.retryAfterSeconds}s antes de tentar novamente.`);
          }

          const deadLetterId = googleSync.pendingBatchId;
          const retryNumber = getGoogleManualRetryCount(googleSync, deadLetterId) + 1;
          const recoveryId = buildGoogleRecoveryId(deadLetterId, retryNumber);
          const savedBatchEvents = getPendingBatchEvents(pendingEvents, googleSync.pendingPhotoIds);
          const recoverySource = savedBatchEvents
            ? buildMakePhotoBatches(savedBatchEvents, MAKE_MAX_PHOTOS_PER_BATCH)[0]
            : batch;
          const recoveryBatch = { ...recoverySource, EVENT_ID: recoveryId, BATCH_ID: recoveryId };
          response = await requestGoogle('/v1/ingress/photo-batch', {
            method: 'POST',
            body: JSON.stringify(buildGooglePhotoBatchIngress(recoveryBatch)),
          });
          googleSync = {
            ...googleSync,
            pendingBatchId: response.state === 'completed' ? undefined : recoveryId,
            pendingPhotoIds: response.state === 'completed'
              ? undefined
              : recoveryBatch.PHOTOS.map((photo) => photo.ID_FOTO),
            manualRetryCount: retryNumber,
            manualRetryAt: getBrasiliaISO(),
            lastDeadLetterId: deadLetterId,
          };
          await saveVisit({
            ...current,
            syncStatus: 'enviando',
            syncError: null,
            payload: { ...current.payload, driveSync: manifest, googleSync },
            updatedAt: getBrasiliaISO(),
          });
          if (response.state !== 'completed') {
            return { visitId: current.visitId, syncStatus: 'enviando', progress: {
              sent: Object.keys(manifest.photos).length, total: events.length,
            } };
          }
          response = { ...response, receipts: response.receipts };
          batch = recoveryBatch;
        }
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
          googleSync = {
            ...googleSync,
            pendingBatchId: batch.BATCH_ID,
            pendingPhotoIds: batch.PHOTOS.map((photo) => photo.ID_FOTO),
          };
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

      const completedJobId = googleSync.pendingBatchId || batch.BATCH_ID;
      const resolved = resolveGooglePhotoReceipts({
        visitId: current.visitId,
        jobId: completedJobId,
        pendingEvents,
        pendingPhotoIds: googleSync.pendingPhotoIds,
        receipts: response.receipts,
      });
      manifest = applyReceipts(manifest, resolved.receipts);
      googleSync = { ...googleSync, pendingBatchId: undefined, pendingPhotoIds: undefined };
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
        if (response.state === 'dead_letter' || (options.recoverDeadLetter && stalePendingJobAtStart)) {
          if (!options.recoverDeadLetter) throw new Error('Finalizacao Google excedeu o limite de tentativas.');

          const retryState = getGoogleRetryState(current);
          if (retryState.remaining === 0) {
            throw new Error('Finalizacao Google requer suporte apos duas tentativas manuais.');
          }
          if (retryState.retryAfterSeconds > 0) {
            throw new Error(`Aguarde ${retryState.retryAfterSeconds}s antes de tentar novamente.`);
          }

          const deadLetterId = googleSync.pendingFinalizeId;
          const retryNumber = getGoogleManualRetryCount(googleSync, deadLetterId) + 1;
          const recoveryId = buildGoogleRecoveryId(deadLetterId, retryNumber);
          response = await requestGoogle('/v1/ingress/finalize', {
            method: 'POST',
            body: JSON.stringify({
              eventType: 'VISIT_FINALIZE',
              eventId: recoveryId,
              idempotencyKey: recoveryId,
              visitId: finalizeEvent.ID_VISITA,
              row: finalizeEvent,
            }),
          });
          googleSync = {
            ...googleSync,
            pendingFinalizeId: response.state === 'completed' ? undefined : recoveryId,
            manualRetryCount: retryNumber,
            manualRetryAt: getBrasiliaISO(),
            lastDeadLetterId: deadLetterId,
          };
          await saveVisit({
            ...current,
            syncStatus: 'enviando',
            syncError: null,
            payload: { ...current.payload, driveSync: manifest, googleSync },
            updatedAt: getBrasiliaISO(),
          });
          if (response.state !== 'completed') {
            return { visitId: current.visitId, syncStatus: 'enviando', progress: { sent, total: events.length } };
          }
          response = { ...response, ...(response.receipt || {}) };
        }
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
