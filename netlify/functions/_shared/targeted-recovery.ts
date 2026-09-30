import { createHash } from 'node:crypto';
import type { VisitRecord } from './visits.ts';

const TARGET_VISIT_ID = 'VISIT-62A55D5A';
const TARGET_OWNER_ID = '80';
const TARGET_STORE_ID = '147';
const TARGET_PHOTO_COUNT = 46;
const TARGET_PHOTO_SET_HASH = '750a045622e65ac50dc5849072704c07a31f99be2a8dcfd7ff994db1d9bb188f';

export const targetedRecoveryVisitId = TARGET_VISIT_ID;

export const hashPhotoIds = (photoIds: string[]) =>
  createHash('sha256').update([...photoIds].sort().join('|')).digest('hex');

export const canRecoverTargetedVisit = (visit: VisitRecord, photoIds: string[]) => {
  if (visit.visitId !== TARGET_VISIT_ID
    || String(visit.payload?.user?.id) !== TARGET_OWNER_ID
    || String(visit.payload?.currentStoreId) !== TARGET_STORE_ID
    || visit.syncStatus === 'enviado'
    || !['erro', 'enviando'].includes(visit.syncStatus)
    || Number(visit.payload?.driveSync?.totalPhotos) !== TARGET_PHOTO_COUNT
    || photoIds.length !== TARGET_PHOTO_COUNT
    || new Set(photoIds).size !== TARGET_PHOTO_COUNT) return false;

  const recovering = Boolean(visit.payload?.googleSync);
  if (!recovering && !/^Make retornou HTTP 400: Queue is full\.$/.test(visit.syncError || '')) return false;

  return hashPhotoIds(photoIds) === TARGET_PHOTO_SET_HASH;
};
