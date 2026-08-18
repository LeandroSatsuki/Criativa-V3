const RETRYABLE_STATUS = new Set([502, 503, 504]);

export const getDefaultRetryCount = (method: string) => {
  const normalized = method.toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD' ? 1 : 0;
};

export const isRetryableHttpStatus = (status: number) => RETRYABLE_STATUS.has(status);

export const shouldExpireAuthSession = (auth: boolean, status: number) => auth && status === 401;
