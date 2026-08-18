import type { AppData } from './data';
import type { VisitSummary, VisitSyncStatus } from './visit-summary';
import { resolveMinimumStoreCount } from './config-integrity.ts';

const STALE_SYNC_AGE_MS = 30 * 60 * 1000;
const ISSUE_LIMIT = 20;
const pendingStatuses = new Set<VisitSyncStatus>(['pendente', 'enviando', 'erro', 'reenviar']);

const getBrasiliaDateKey = (value: string | Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(typeof value === 'string' ? new Date(value) : value);

const sanitizeError = (value: string | null | undefined) => {
  const message = String(value || '').replace(/https?:\/\/\S+/gi, '[URL REMOVIDA]').replace(/\s+/g, ' ').trim();
  return message ? message.slice(0, 240) : null;
};

const countStatuses = (visits: VisitSummary[]) => visits.reduce<Record<VisitSyncStatus, number>>(
  (counts, visit) => ({ ...counts, [visit.syncStatus]: counts[visit.syncStatus] + 1 }),
  { pendente: 0, enviando: 0, enviado: 0, erro: 0, reenviar: 0 },
);

export const buildOperationsHealth = (
  data: AppData,
  visits: VisitSummary[],
  configuredMinimum?: string,
  now = new Date(),
) => {
  const minimumStoreCount = resolveMinimumStoreCount(configuredMinimum);
  const promoterIds = new Set(data.promoters.map((promoter) => promoter.id));
  const storesWithoutSchedule = data.stores.filter((store) => !store.routeDays?.length);
  const storesWithoutAssignment = data.stores.filter((store) => !store.routePromoterIds?.length);
  const invalidAssignmentIds = Array.from(new Set(
    data.stores.flatMap((store) => store.routePromoterIds || []).filter((id) => !promoterIds.has(id)),
  ));
  const todayKey = getBrasiliaDateKey(now);
  const todayVisits = visits.filter((visit) => getBrasiliaDateKey(visit.updatedAt) === todayKey);
  const staleBefore = now.getTime() - STALE_SYNC_AGE_MS;
  const staleSending = visits.filter((visit) => (
    visit.syncStatus === 'enviando' && new Date(visit.updatedAt).getTime() < staleBefore
  ));
  const issues = visits
    .filter((visit) => pendingStatuses.has(visit.syncStatus))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, ISSUE_LIMIT)
    .map((visit) => ({
      visitId: visit.visitId,
      promoter: visit.payload?.user?.name || '',
      store: visit.payload?.currentStore || '',
      status: visit.syncStatus,
      updatedAt: visit.updatedAt,
      error: sanitizeError(visit.syncError),
    }));
  const cacheTimestamp = data.cachedAt ? new Date(data.cachedAt).getTime() : Number.NaN;
  const cacheAgeSeconds = Number.isFinite(cacheTimestamp)
    ? Math.max(0, Math.floor((now.getTime() - cacheTimestamp) / 1000))
    : null;
  const allStatuses = countStatuses(visits);
  const todayStatuses = countStatuses(todayVisits);
  const sourceCritical = data.stores.length < minimumStoreCount;
  const syncCritical = allStatuses.erro > 0 || staleSending.length > 0;
  const assignmentAttention = invalidAssignmentIds.length > 0;

  return {
    status: sourceCritical ? 'critical' : (syncCritical || assignmentAttention ? 'attention' : 'ok'),
    generatedAt: now.toISOString(),
    source: {
      storeCount: data.stores.length,
      minimumStoreCount,
      promoterCount: data.promoters.length,
      activePromoters: data.promoters.filter((promoter) => promoter.status !== 'INATIVO').length,
      inactivePromoters: data.promoters.filter((promoter) => promoter.status === 'INATIVO').length,
      storesWithoutSchedule: storesWithoutSchedule.length,
      storesWithoutAssignment: storesWithoutAssignment.length,
      invalidAssignmentIds,
      cachedAt: data.cachedAt || null,
      cacheAgeSeconds,
    },
    synchronization: {
      total: visits.length,
      statuses: allStatuses,
      today: {
        total: todayVisits.length,
        statuses: todayStatuses,
      },
      staleSending: staleSending.length,
      issues,
    },
  };
};
