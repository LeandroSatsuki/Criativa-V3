export const DEFAULT_MAKE_REQUEST_TIMEOUT_MS = 45000;
export const MIN_MAKE_REQUEST_TIMEOUT_MS = 500;
export const MAX_MAKE_REQUEST_TIMEOUT_MS = 60000;

export const parseMakeRequestTimeoutMs = (value?: string) => {
  const configured = Number(value);
  return Number.isInteger(configured)
    && configured >= MIN_MAKE_REQUEST_TIMEOUT_MS
    && configured <= MAX_MAKE_REQUEST_TIMEOUT_MS
    ? configured
    : DEFAULT_MAKE_REQUEST_TIMEOUT_MS;
};
