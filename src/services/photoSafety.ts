import { localPhotoIds, readLocalPhoto, LocalPhotoUnavailableError } from './litePhotos';
import { getSession } from './session';
import { isPhotoCaptureBusy } from './liteMode';
import { photoRecoveryEnabled, protectPhotoCopy, recordPhotoDiagnostic } from './photoRecoveryClient';
import { isQueuedVisitUploading } from './queuedVisitDelivery';
export type PhotoProtection = { protected: number; missing: number; failed: number; remaining: number };
let running: Promise<PhotoProtection> | null = null;
// Bounded reference metadata, never cached image bytes.
const acknowledged = new Set<string>();
const deferred = new Map<string, number>();
let acknowledgedOwner = '';
export const protectVisitPhotos = (ownerId: string, visitId: string, payload: unknown, manual = false): Promise<PhotoProtection> => {
  if (running) return running.then(() => protectVisitPhotos(ownerId, visitId, payload, manual));
  if (!photoRecoveryEnabled(ownerId)) return Promise.resolve({ protected: 0, missing: 0, failed: 0, remaining: 0 });
  const operation = (async () => {
    const report: PhotoProtection = { protected: 0, missing: 0, failed: 0, remaining: 0 };
    if (acknowledgedOwner !== ownerId) { acknowledged.clear(); deferred.clear(); acknowledgedOwner = ownerId; }
    const items: { photoId: string; status: string }[] = [];
    let attempted = 0;
    const refs = localPhotoIds(payload);
    for (const ref of refs) {
      if (String(getSession()?.user.id || '') !== ownerId || !navigator.onLine || isPhotoCaptureBusy() || isQueuedVisitUploading(ownerId, visitId)) break;
      const key = `${visitId}:${ref}`;
      if (acknowledged.has(key)) { report.protected++; items.push({ photoId: ref, status: 'protected' }); continue; }
      if (!manual && Date.now() - (deferred.get(key) || 0) < 300000) continue;
      if (!manual && attempted++ >= 4) break;
      try {
        const photo = await readLocalPhoto(ownerId, ref);
        await protectPhotoCopy(ownerId, ref, visitId, photo);
        if (acknowledged.size >= 512) acknowledged.delete(acknowledged.values().next().value!);
        acknowledged.add(key); deferred.delete(key); report.protected++; items.push({ photoId: ref, status: 'protected' });
      } catch (error) {
        const missing = error instanceof LocalPhotoUnavailableError && error.reason === 'missing';
        if (missing) report.missing++; else report.failed++;
        if (deferred.size >= 512) deferred.delete(deferred.keys().next().value!);
        deferred.set(key, Date.now()); items.push({ photoId: ref, status: missing ? 'missing' : 'failed' });
      }
    }
    report.remaining = refs.size - items.length;
    if (manual && String(getSession()?.user.id || '') === ownerId) await recordPhotoDiagnostic(ownerId, visitId, items);
    return report;
  })().finally(() => { running = null; });
  running = operation; return operation;
};
