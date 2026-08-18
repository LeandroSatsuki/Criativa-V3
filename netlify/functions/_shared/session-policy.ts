export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const renewSessionExpiration = <T extends { exp: number }>(
  payload: T,
  now = Date.now(),
): T => ({
  ...payload,
  exp: now + SESSION_TTL_MS,
});
