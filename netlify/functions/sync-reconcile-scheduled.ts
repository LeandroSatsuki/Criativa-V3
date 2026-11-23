import type { Config } from '@netlify/functions';
import { getEnv } from './_shared/env';
import { syncVisitRecord } from './_shared/sync';
import { resolveReconciliationCandidate } from './_shared/sync-reconcile-policy';
import { buildVisitSummary } from './_shared/visit-summary';
import { getVisit, listPendingVisitSummaries, repairCompletedVisitSummary, type VisitRecord } from './_shared/visits';

export default async () => {
  if ((getEnv('BACKEND_SYNC_PROVIDER') || '').trim().toLowerCase() !== 'google-v1') return;

  const summaries = await listPendingVisitSummaries();
  const visit = await resolveReconciliationCandidate<VisitRecord>(summaries, {
    get: getVisit, summarize: buildVisitSummary, repairCompleted: repairCompletedVisitSummary,
  });
  if (!visit) return;

  const result = await syncVisitRecord(visit, { recoverDeadLetter: true });
  console.info(JSON.stringify({
    event: 'visit_sync_reconciled',
    visitId: result.visitId,
    syncStatus: result.syncStatus,
    progress: result.progress || null,
  }));
};

export const config: Config = {
  schedule: '*/5 * * * *',
};
