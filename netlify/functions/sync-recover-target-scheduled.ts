import type { Config } from '@netlify/functions';
import { buildMakePhotoEvents } from './_shared/make-contract-v2.ts';
import { getEnv } from './_shared/env.ts';
import { syncVisitRecord } from './_shared/sync.ts';
import { canRecoverTargetedVisit, targetedRecoveryVisitId } from './_shared/targeted-recovery.ts';
import { getVisit } from './_shared/visits.ts';

export default async () => {
  if (getEnv('BACKEND_SYNC_PROVIDER') !== 'google-v1') return;

  const visit = await getVisit(targetedRecoveryVisitId);
  if (!visit) return;

  const photoIds = buildMakePhotoEvents(visit.payload).map((event) => event.ID_FOTO);
  if (!canRecoverTargetedVisit(visit, photoIds)) return;

  const result = await syncVisitRecord(visit, { recoverDeadLetter: true });
  console.info(JSON.stringify({
    event: 'targeted_visit_recovery',
    visitId: result.visitId,
    syncStatus: result.syncStatus,
    progress: result.progress || null,
  }));
};

export const config: Config = { schedule: '* * * * *' };
