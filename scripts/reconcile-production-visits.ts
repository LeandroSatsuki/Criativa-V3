import { getGoogleRetryState } from '../netlify/functions/_shared/google-sync.ts';
import { syncVisitRecord } from '../netlify/functions/_shared/sync.ts';
import { getVisit } from '../netlify/functions/_shared/visits.ts';

const args = process.argv.slice(2);
const apply = args[0] === '--apply';
const visitIds = (apply ? args.slice(1) : args)
  .map((value) => value.trim().toUpperCase())
  .filter((value) => /^VISIT-[A-Z0-9]+$/.test(value));

if (!visitIds.length) {
  throw new Error('Informe ao menos um ID no formato VISIT-XXXXXXXX.');
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

for (const visitId of visitIds) {
  let visit = await getVisit(visitId);
  if (!visit) {
    console.log(JSON.stringify({ visitId, action: 'missing' }));
    continue;
  }

  const photoCount = Object.values(visit.payload?.photos || {}).reduce<number>(
    (total, photos) => total + (Array.isArray(photos) ? photos.length : 0),
    0,
  ) + Object.values(visit.payload?.industryExecutions || {}).reduce<number>(
    (total, execution: any) => total + Object.values(execution?.photos || {}).reduce<number>(
      (executionTotal, photos) => executionTotal + (Array.isArray(photos) ? photos.length : 0),
      0,
    ),
    0,
  );
  const manifest = visit.payload?.driveSync || {};
  console.log(JSON.stringify({
    visitId,
    action: apply ? 'reconcile' : 'dry-run',
    status: visit.syncStatus,
    photoCount,
    sent: Object.keys(manifest.photos || {}).length,
    total: Number(manifest.totalPhotos || 0),
    finalized: Boolean(manifest.finalizedAt),
    retry: getGoogleRetryState(visit),
  }));

  if (!apply || visit.syncStatus === 'enviado' || photoCount < 1) continue;

  for (let step = 1; step <= 30; step += 1) {
    const result = await syncVisitRecord(visit, { recoverDeadLetter: true });
    console.log(JSON.stringify({ visitId, step, ...result }));
    if (result.syncStatus !== 'enviando') break;
    await delay(2_500);
    visit = await getVisit(visitId);
    if (!visit) break;
  }
}
