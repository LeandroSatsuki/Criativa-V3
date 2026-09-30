const GOOGLE_POLL_DELAY_MS = 2_000;

export const resolveSyncProvider = (value?: string) => {
  const provider = value?.trim().toLowerCase();
  return provider === 'google-v1' || provider === 'make' ? provider : null;
};

export const getBackgroundPollDelayMs = (provider?: string) =>
  resolveSyncProvider(provider) === 'google-v1' ? GOOGLE_POLL_DELAY_MS : 0;
