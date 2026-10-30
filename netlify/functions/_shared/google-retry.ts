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

const LEGACY_MAKE_PHOTO_CONFIRMATION_ERROR = /Make n(?:ao|ão) confirmou (?:o upload da foto|todas as fotos do lote) no Google Drive\.?/i;

export const isLegacyMakePhotoConfirmationError = (error: unknown) =>
  LEGACY_MAKE_PHOTO_CONFIRMATION_ERROR.test(String(error || ''));

export const formatSyncErrorForProvider = (error: string | null | undefined, provider: string | undefined) => {
  if (!error || String(provider || '').trim().toLowerCase() !== 'google-v1') return error || null;
  return isLegacyMakePhotoConfirmationError(error) ? error.replace(/^Make/i, 'Google') : error;
};

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
  const syncError = String(visit.syncError || '');
  const legacyPhotoConfirmationError = isLegacyMakePhotoConfirmationError(syncError);
  const retryable = visit.syncStatus === 'erro'
    && (legacyPhotoConfirmationError || (
      Boolean(pendingId)
      && /(Google excedeu o limite de tentativas|Google requer suporte|Aguarde \d+s|Google n(?:ao|ão) confirmou todas as fotos do lote no Google Drive)/i.test(syncError)
    ));
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
