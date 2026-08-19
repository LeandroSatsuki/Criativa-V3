const GOOGLE_POLL_DELAY_MS = 2_000;

export const getBackgroundPollDelayMs = (provider?: string) =>
  provider?.trim().toLowerCase() === 'google-v1' ? GOOGLE_POLL_DELAY_MS : 0;
