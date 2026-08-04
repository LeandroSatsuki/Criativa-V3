export const isNetworkRequestFailure = (
  error: unknown,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
) => !online || error instanceof TypeError;
