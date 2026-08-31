import type { VisitSummary } from './visit-summary';

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
    return visit.syncStatus === 'enviando' && age >= SENDING_RECONCILE_AGE_MS;
  })
  .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))[0];
