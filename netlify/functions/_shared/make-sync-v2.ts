import { getBrasiliaISO } from './time';
import { saveVisit, type VisitRecord } from './visits';
import {
  buildMakePhotoEvents,
  buildMakeVisitFinalizeEvent,
  MAKE_CONTRACT_VERSION,
  MAKE_PHOTOS_PER_RUN,
  validatePhotoUploadResponse,
  validateVisitFinalizeResponse,
  type DriveSyncManifest,
} from './make-contract-v2';

type V2SyncResult = {
  visitId: string;
  syncStatus: VisitRecord['syncStatus'];
  syncError?: string | null;
  progress?: {
    sent: number;
    total: number;
  };
};

const postMakeEvent = async (webhookUrl: string, event: unknown) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    const body = (await response.text().catch(() => '')).slice(0, 5000);
    if (!response.ok) {
      throw new Error(`Make retornou HTTP ${response.status}: ${body || response.statusText}`);
    }
    return body;
  } finally {
    clearTimeout(timeoutId);
  }
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

export const syncVisitRecordV2 = async (visit: VisitRecord, webhookUrl: string): Promise<V2SyncResult> => {
  const events = buildMakePhotoEvents(visit.payload);
  let manifest = createManifest(visit, events.length);
  let current = await saveVisit({
    ...visit,
    syncStatus: 'enviando',
    syncError: null,
    payload: { ...visit.payload, driveSync: manifest },
    updatedAt: getBrasiliaISO(),
  });

  try {
    const pendingEvents = events.filter((event) => !manifest.photos[event.ID_FOTO]);
    const currentBatch = pendingEvents.slice(0, MAKE_PHOTOS_PER_RUN);

    for (const event of currentBatch) {
      const responseBody = await postMakeEvent(webhookUrl, event);
      const receipt = validatePhotoUploadResponse(responseBody, event);
      manifest = {
        ...manifest,
        folderId: manifest.folderId || receipt.folderId,
        folderUrl: manifest.folderUrl || receipt.folderUrl,
        photos: { ...manifest.photos, [event.ID_FOTO]: receipt },
      };
      current = await saveVisit({
        ...current,
        syncStatus: 'enviando',
        syncError: null,
        payload: { ...current.payload, driveSync: manifest },
        updatedAt: getBrasiliaISO(),
      });
    }

    const sent = Object.keys(manifest.photos).length;
    if (sent < events.length) {
      return {
        visitId: current.visitId,
        syncStatus: 'enviando',
        syncError: null,
        progress: { sent, total: events.length },
      };
    }

    if (!manifest.finalizedAt) {
      const finalizeEvent = buildMakeVisitFinalizeEvent(current.payload, events, manifest);
      const responseBody = await postMakeEvent(webhookUrl, finalizeEvent);
      const confirmation = validateVisitFinalizeResponse(responseBody, finalizeEvent);
      manifest = {
        ...manifest,
        finalizedAt: getBrasiliaISO(),
        rowAction: confirmation.rowAction,
        rowId: confirmation.rowId,
      };
    }

    const completed = await saveVisit({
      ...current,
      syncStatus: 'enviado',
      syncError: null,
      payload: { ...current.payload, driveSync: manifest },
      makeResponse: {
        status: 200,
        ok: true,
        body: JSON.stringify({
          contractVersion: MAKE_CONTRACT_VERSION,
          photos: Object.keys(manifest.photos).length,
          rowAction: manifest.rowAction,
          rowId: manifest.rowId,
        }),
      },
      updatedAt: getBrasiliaISO(),
    });

    return {
      visitId: completed.visitId,
      syncStatus: completed.syncStatus,
      syncError: null,
      progress: { sent: events.length, total: events.length },
    };
  } catch (error: any) {
    const message = error?.name === 'AbortError'
      ? 'Tempo esgotado aguardando a confirmação do Make/Google Drive.'
      : error?.message || 'Falha na sincronização v2.';
    const errored = await saveVisit({
      ...current,
      syncStatus: 'erro',
      syncError: message,
      payload: { ...current.payload, driveSync: manifest },
      updatedAt: getBrasiliaISO(),
    });

    return {
      visitId: errored.visitId,
      syncStatus: errored.syncStatus,
      syncError: errored.syncError,
      progress: { sent: Object.keys(manifest.photos).length, total: events.length },
    };
  }
};

