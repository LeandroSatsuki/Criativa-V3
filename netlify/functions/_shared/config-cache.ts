export const CONFIG_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

export const isConfigCacheFresh = (
  cachedAt: string | null | undefined,
  now = Date.now(),
) => {
  if (!cachedAt) return false;

  const cachedTime = new Date(cachedAt).getTime();
  if (!Number.isFinite(cachedTime)) return false;

  const age = now - cachedTime;
  return age >= 0 && age < CONFIG_CACHE_MAX_AGE_MS;
};
