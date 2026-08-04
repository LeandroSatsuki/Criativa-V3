import type { Role } from '../types';

const OPERATIONAL_CACHE_PREFIX = 'CRIATIVA_OPERATIONAL_CACHE_V1:';
export const OPERATIONAL_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type OperationalCacheRecord = {
  version: 1;
  ownerId: string;
  ownerRole: Role;
  cachedAt: string;
  stores: any[];
  industries: string[];
};

export const buildOperationalCacheKey = (ownerId: string) =>
  `${OPERATIONAL_CACHE_PREFIX}${encodeURIComponent(ownerId.trim())}`;

export const isOperationalCacheFresh = (
  cachedAt: string | undefined,
  now = Date.now(),
) => {
  if (!cachedAt) return false;
  const timestamp = Date.parse(cachedAt);
  if (!Number.isFinite(timestamp) || timestamp > now) return false;
  return now - timestamp < OPERATIONAL_CACHE_MAX_AGE_MS;
};

export const parseOperationalCache = (
  raw: string | null,
  ownerId: string,
  now = Date.now(),
): OperationalCacheRecord | null => {
  if (!raw || !ownerId.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OperationalCacheRecord>;
    if (
      parsed.version !== 1 ||
      parsed.ownerId !== ownerId ||
      parsed.ownerRole !== 'FIELD_OPS' ||
      !Array.isArray(parsed.stores) ||
      !Array.isArray(parsed.industries) ||
      !isOperationalCacheFresh(parsed.cachedAt, now)
    ) {
      return null;
    }

    return parsed as OperationalCacheRecord;
  } catch {
    return null;
  }
};

export const readOperationalCache = (ownerId: string) => {
  try {
    return parseOperationalCache(
      localStorage.getItem(buildOperationalCacheKey(ownerId)),
      ownerId,
    );
  } catch {
    return null;
  }
};

export const writeOperationalCache = (
  ownerId: string,
  ownerRole: Role,
  stores: any[],
  industries: string[],
) => {
  if (!ownerId.trim() || ownerRole !== 'FIELD_OPS') return false;

  const record: OperationalCacheRecord = {
    version: 1,
    ownerId,
    ownerRole,
    cachedAt: new Date().toISOString(),
    stores,
    industries,
  };

  try {
    localStorage.setItem(buildOperationalCacheKey(ownerId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
};
