import type { VisitSummary } from './visit-summary';
import { isLegacyMakePhotoConfirmationError } from './google-retry.ts';

const PENDING_RECONCILE_AGE_MS = 10 * 60 * 1000;
const SENDING_RECONCILE_AGE_MS = 5 * 60 * 1000;

export const selectVisitForReconciliation = (
  visits: VisitSummary[],
  now = Date.now(),
) => visits
  .filter((visit) => {
    if (visit.photoCount < 1) return false;
    const updatedAt = Date.parse(visit.updatedAt);
    if (!Number.isFinite(updatedAt)) return false;
    const age = now - updatedAt;
    if (visit.syncStatus === 'pendente') {
      return !visit.syncError && age >= PENDING_RECONCILE_AGE_MS;
    }
    if (visit.syncStatus === 'erro') {
      return isLegacyMakePhotoConfirmationError(visit.syncError) && age >= PENDING_RECONCILE_AGE_MS;
    }
    return visit.syncStatus === 'enviando' && age >= SENDING_RECONCILE_AGE_MS;
  })
  .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))[0];

// The index is advisory. Recheck the authoritative record before retrying work.
export const resolveReconciliationCandidate = async <T>(
  summaries: VisitSummary[],
  dependencies: {
    get: (visitId: string) => Promise<T | null>;
    summarize: (record: T) => VisitSummary;
    repairCompleted: (record: T) => Promise<void>;
  },
  now = Date.now(),
) => {
  let remaining = summaries;
  for (let checked = 0; checked < 8; checked++) {
    const candidate = selectVisitForReconciliation(remaining, now);
    if (!candidate) return null;
    remaining = remaining.filter(item => item.visitId !== candidate.visitId);
    const record = await dependencies.get(candidate.visitId);
    if (!record) continue;
    const fresh = dependencies.summarize(record);
    if (fresh.syncStatus === 'enviado') {
      await dependencies.repairCompleted(record);
      continue;
    }
    if (selectVisitForReconciliation([fresh], now)) return record;
  }
  return null;
};
