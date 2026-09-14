import type { Config } from '@netlify/functions';
import { getEnv } from './_shared/env';
import { syncVisitRecord } from './_shared/sync';
import { selectVisitForReconciliation } from './_shared/sync-reconcile-policy';
import { getVisit, listPendingVisitSummaries } from './_shared/visits';

export default async () => {
  if ((getEnv('BACKEND_SYNC_PROVIDER') || '').trim().toLowerCase() !== 'google-v1') return;

  const summaries = await listPendingVisitSummaries();
  const candidate = selectVisitForReconciliation(summaries);
  if (!candidate) return;

  const visit = await getVisit(candidate.visitId);
  if (!visit || visit.syncStatus === 'enviado') return;

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
