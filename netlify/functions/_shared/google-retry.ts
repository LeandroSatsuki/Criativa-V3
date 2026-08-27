export type GoogleSyncRetryState = {
  pendingBatchId?: string;
  pendingPhotoIds?: string[];
  pendingFinalizeId?: string;
  manualRetryCount?: number;
  manualRetryAt?: string;
  lastDeadLetterId?: string;
};

type RetryVisit = {
  syncStatus: string;
  syncError?: string | null;
  payload?: { googleSync?: GoogleSyncRetryState };
};

export const GOOGLE_MANUAL_RETRY_LIMIT = 2;
export const GOOGLE_MANUAL_RETRY_COOLDOWN_MS = 60_000;

const getRecoveryRootId = (jobId: string) => jobId.replace(/:RETRY:\d+$/, '');

export const getGoogleManualRetryCount = (state: GoogleSyncRetryState, jobId: string) => (
  state.lastDeadLetterId
  && getRecoveryRootId(state.lastDeadLetterId) !== getRecoveryRootId(jobId)
    ? 0
    : Math.max(0, Number(state.manualRetryCount || 0))
);

export const getGoogleRetryState = (visit: RetryVisit, now = Date.now()) => {
  const googleSync = visit.payload?.googleSync || {};
  const pendingId = googleSync.pendingBatchId || googleSync.pendingFinalizeId || '';
  const retryable = visit.syncStatus === 'erro'
    && Boolean(pendingId)
    && /(Google excedeu o limite de tentativas|Google requer suporte|Aguarde \d+s|(?:Make|Google) n(?:ao|ão) confirmou todas as fotos do lote no Google Drive)/i.test(String(visit.syncError || ''));
  const used = getGoogleManualRetryCount(googleSync, pendingId);
  const lastRetryAt = googleSync.manualRetryAt ? Date.parse(googleSync.manualRetryAt) : 0;
  const retryAfterMs = Number.isFinite(lastRetryAt)
    ? Math.max(0, lastRetryAt + GOOGLE_MANUAL_RETRY_COOLDOWN_MS - now)
    : 0;

  return {
    retryable,
    available: retryable && used < GOOGLE_MANUAL_RETRY_LIMIT && retryAfterMs === 0,
    remaining: Math.max(0, GOOGLE_MANUAL_RETRY_LIMIT - used),
    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
  };
};

export const buildGoogleRecoveryId = (originalId: string, retryNumber: number) =>
  `${getRecoveryRootId(originalId)}:RETRY:${retryNumber}`;
