import type { SupervisorDashboardResponse } from '../../../src/types';
import { getJsonStore } from './storage.ts';

export const SUPERVISOR_DASHBOARD_CACHE_TTL_MS = 60_000;

export type SupervisorDashboardCacheEntry = {
  cachedAt: string;
  dashboard: SupervisorDashboardResponse;
};

const cacheStore = getJsonStore('criativa-supervisor-cache');
const CACHE_KEY = 'dashboard-v1';

export const getFreshSupervisorDashboard = (
  entry: SupervisorDashboardCacheEntry | null,
  now = Date.now(),
) => {
  if (!entry?.dashboard || !entry.cachedAt) return null;
  const cachedAt = Date.parse(entry.cachedAt);
  if (!Number.isFinite(cachedAt) || cachedAt > now) return null;
  return now - cachedAt <= SUPERVISOR_DASHBOARD_CACHE_TTL_MS ? entry.dashboard : null;
};

export const readSupervisorDashboardCache = async () => getFreshSupervisorDashboard(
  await cacheStore.get<SupervisorDashboardCacheEntry>(CACHE_KEY),
);

export const writeSupervisorDashboardCache = async (dashboard: SupervisorDashboardResponse) => {
  await cacheStore.set(CACHE_KEY, { cachedAt: new Date().toISOString(), dashboard });
};
