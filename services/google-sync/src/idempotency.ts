import { createHash } from 'node:crypto';

export type JobState = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export type SyncJob<TReceipt = unknown> = {
  id: string;
  state: JobState;
  attempts: number;
  leaseUntil?: string;
  receipt?: TReceipt;
  lastError?: string;
};

export type ClaimResult<TReceipt = unknown> =
  | { action: 'claimed'; job: SyncJob<TReceipt> }
  | { action: 'completed'; job: SyncJob<TReceipt> }
  | { action: 'leased'; job: SyncJob<TReceipt> }
  | { action: 'dead_letter'; job: SyncJob<TReceipt> };

const cleanError = (error: unknown) => String(error || 'Falha desconhecida')
  .replace(/[\r\n\t]+/g, ' ')
  .slice(0, 500);

export const deterministicTaskName = (kind: string, idempotencyKey: string) => {
  const prefix = String(kind || 'job').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 24);
  const hash = createHash('sha256').update(`${kind}:${idempotencyKey}`).digest('hex');
  return `${prefix || 'job'}-${hash}`;
};

export const stagingObjectName = (visitId: string, photoId: string) => {
  const visitHash = createHash('sha256').update(visitId).digest('hex').slice(0, 24);
  const photoHash = createHash('sha256').update(photoId).digest('hex');
  return `staging/${visitHash}/${photoHash}.jpg`;
};

export const claimJob = <TReceipt>(
  job: SyncJob<TReceipt>,
  now: Date,
  leaseMs: number,
  maxAttempts: number,
): ClaimResult<TReceipt> => {
  if (job.state === 'completed') return { action: 'completed', job };
  if (job.state === 'dead_letter' || job.attempts >= maxAttempts) {
    return { action: 'dead_letter', job: { ...job, state: 'dead_letter', leaseUntil: undefined } };
  }

  const leaseUntil = job.leaseUntil ? Date.parse(job.leaseUntil) : 0;
  if (job.state === 'processing' && Number.isFinite(leaseUntil) && leaseUntil > now.getTime()) {
    return { action: 'leased', job };
  }

  return {
    action: 'claimed',
    job: {
      ...job,
      state: 'processing',
      attempts: job.attempts + 1,
      leaseUntil: new Date(now.getTime() + leaseMs).toISOString(),
      lastError: undefined,
    },
  };
};

export const completeJob = <TReceipt>(
  job: SyncJob<TReceipt>,
  receipt: TReceipt,
): SyncJob<TReceipt> => ({
  ...job,
  state: 'completed',
  leaseUntil: undefined,
  lastError: undefined,
  receipt,
});

export const failJob = <TReceipt>(
  job: SyncJob<TReceipt>,
  error: unknown,
  maxAttempts: number,
): SyncJob<TReceipt> => ({
  ...job,
  state: job.attempts >= maxAttempts ? 'dead_letter' : 'failed',
  leaseUntil: undefined,
  lastError: cleanError(error),
});
