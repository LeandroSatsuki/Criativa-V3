export const STALE_SYNC_AGE_MS = 24 * 60 * 60 * 1000;

export const isStaleSync = (createdAt: string, now = Date.now()) => {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && created <= now && now - created >= STALE_SYNC_AGE_MS;
};
