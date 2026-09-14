import { Firestore, Timestamp } from '@google-cloud/firestore';
import { claimJob, completeJob, failJob, type ClaimResult, type SyncJob } from './idempotency.js';

export type JobRepository = {
  get<T>(id: string): Promise<SyncJob<T> | undefined>;
  claim<T>(id: string, now: Date): Promise<ClaimResult<T>>;
  complete<T>(job: SyncJob<T>, receipt: T): Promise<void>;
  fail<T>(job: SyncJob<T>, error: unknown): Promise<void>;
};

export class FirestoreJobRepository implements JobRepository {
  constructor(
    private readonly firestore: Firestore,
    private readonly leaseMs = 5 * 60 * 1000,
    private readonly maxAttempts = 5,
  ) {}

  async get<T>(id: string) {
    const snapshot = await this.firestore.collection('sync_jobs').doc(id).get();
    if (!snapshot.exists) return undefined;
    const raw = snapshot.data();
    return {
      id,
      state: raw?.state,
      attempts: raw?.attempts || 0,
      leaseUntil: raw?.leaseUntil instanceof Timestamp ? raw.leaseUntil.toDate().toISOString() : undefined,
      receipt: raw?.receipt,
      lastError: raw?.lastError,
    } as SyncJob<T>;
  }

  async claim<T>(id: string, now: Date): Promise<ClaimResult<T>> {
    const reference = this.firestore.collection('sync_jobs').doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const raw = snapshot.exists ? snapshot.data() : undefined;
      const current: SyncJob<T> = raw ? {
        id,
        state: raw.state,
        attempts: raw.attempts || 0,
        leaseUntil: raw.leaseUntil instanceof Timestamp ? raw.leaseUntil.toDate().toISOString() : undefined,
        receipt: raw.receipt,
        lastError: raw.lastError,
      } : { id, state: 'pending', attempts: 0 };
      const result = claimJob(current, now, this.leaseMs, this.maxAttempts);
      if (result.action === 'claimed' || result.action === 'dead_letter') {
        transaction.set(reference, {
          state: result.job.state,
          attempts: result.job.attempts,
          leaseUntil: result.job.leaseUntil ? Timestamp.fromDate(new Date(result.job.leaseUntil)) : null,
          lastError: result.job.lastError || null,
          updatedAt: Timestamp.fromDate(now),
        }, { merge: true });
      }
      return result;
    });
  }

  async complete<T>(job: SyncJob<T>, receipt: T) {
    const completed = completeJob(job, receipt);
    await this.firestore.collection('sync_jobs').doc(job.id).set({
      state: completed.state,
      attempts: completed.attempts,
      leaseUntil: null,
      lastError: null,
      receipt,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  async fail<T>(job: SyncJob<T>, error: unknown) {
    const failed = failJob(job, error, this.maxAttempts);
    await this.firestore.collection('sync_jobs').doc(job.id).set({
      state: failed.state,
      attempts: failed.attempts,
      leaseUntil: null,
      lastError: failed.lastError,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }
}
