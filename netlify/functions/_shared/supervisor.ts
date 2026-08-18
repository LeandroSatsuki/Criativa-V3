import type { AppData } from './data';
import type { VisitRecord } from './visits';
import type { VisitSummary } from './visit-summary';
import { getBrasiliaWeekday, getStoresForUser } from './store-routes.ts';
import { formatBrasiliaDate, formatBrasiliaTime } from './time.ts';

type SupervisorVisit = VisitRecord | VisitSummary;
type PlannedStore = AppData['stores'][number];

export type SupervisorTimelinePoint = {
  time: string;
  totalVisits: number;
  completedVisits: number;
  pendingSyncVisits: number;
};

export type SupervisorPromoterOverview = {
  id: string;
  name: string;
  user: string;
  region: string;
  phone: string;
  registered: boolean;
  registrationStatus: 'ATIVO' | 'INATIVO';
  activeToday: boolean;
  hasRouteToday: boolean;
  status: 'CONCLUÍDO' | 'EM ANDAMENTO' | 'PENDENTE' | 'SEM ATIVIDADE' | 'INATIVO';
  online: boolean;
  progress: number;
  store: string;
  lastSync: string;
  visits: {
    completed: number;
    total: number;
  };
  todayVisits: {
    completed: number;
    pending: number;
    total: number;
    recorded: number;
    extra: number;
    duplicates: number;
  };
  pendingSyncVisits: number;
  lastVisitId: string | null;
};

export type SupervisorDashboardSummary = {
  totalPromoters: number;
  activePromoters: number;
  inactivePromoters: number;
  onlinePromoters: number;
  offlinePromoters: number;
  onRoutePromoters: number;
  activeTodayPromoters: number;
  inProgressPromoters: number;
  completedPromoters: number;
  pendingPromoters: number;
  pendingSyncVisits: number;
  pendingSyncPromoters: number;
  totalVisits: number;
  completedVisits: number;
  pendingVisits: number;
  recordedVisits: number;
  extraVisits: number;
  duplicateVisits: number;
  averageVisitTime: string;
  lastUpdated: string;
};

export type SupervisorDashboardResponse = {
  summary: SupervisorDashboardSummary;
  timeline: SupervisorTimelinePoint[];
  promoters: SupervisorPromoterOverview[];
  lastUpdated: string;
};

export type SupervisorPromoterDetailRouteItem = {
  id: string;
  visitId: string;
  name: string;
  time: string;
  date: string;
  status: 'CONCLUÍDO' | 'EM ANDAMENTO' | 'PENDENTE';
  tasks: number;
  photos: number;
  syncStatus: VisitRecord['syncStatus'];
};

export type SupervisorPromoterDetailResponse = {
  profile: {
    id: string;
    name: string;
    user: string;
    region: string;
    phone: string;
    registered: boolean;
    registrationStatus: 'ATIVO' | 'INATIVO';
  };
  metrics: {
    efficiency: string;
    workingTime: string;
    completedVisits: number;
    totalVisits: number;
    pendingSyncVisits: number;
    averageDuration: string;
  };
  route: SupervisorPromoterDetailRouteItem[];
};

const pendingSyncStatuses = new Set<VisitRecord['syncStatus']>(['pendente', 'erro', 'reenviar', 'enviando']);

const formatDuration = (milliseconds: number) => {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}h`;
};

const getTimestamp = (visit: SupervisorVisit) =>
  visit.payload?.checkInTime || visit.payload?.checkOutTime || visit.updatedAt || visit.createdAt;

const getBrasiliaDateKey = (value: string | Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(typeof value === 'string' ? new Date(value) : value);

const isVisitFromDate = (visit: SupervisorVisit, dateKey: string) => {
  const timestamp = getTimestamp(visit);
  return Boolean(timestamp && getBrasiliaDateKey(timestamp) === dateKey);
};

const normalizeIdentity = (value: unknown) => String(value || '').toLowerCase().trim();

const getVisitOwnerKeys = (visit: SupervisorVisit) => [
  normalizeIdentity(visit.payload?.user?.id),
  normalizeIdentity(visit.payload?.user?.user),
].filter(Boolean);

const countVisitPhotos = (visit: SupervisorVisit) => {
  if ('photoCount' in visit) return visit.photoCount;
  const uniquePhotos = new Set<string>();
  const addPhotos = (photos: unknown) => {
    if (!Array.isArray(photos)) return;
    photos.forEach((photo) => {
      if (typeof photo === 'string' && photo.trim()) uniquePhotos.add(photo);
    });
  };

  Object.values(visit.payload?.photos || {}).forEach(addPhotos);
  Object.values(visit.payload?.industryExecutions || {}).forEach((execution: any) => {
    Object.values(execution?.photos || {}).forEach(addPhotos);
  });
  Object.values(visit.payload?.returnsPhotosByIndustry || {}).forEach(addPhotos);

  return uniquePhotos.size;
};

const countVisitTasks = (visit: SupervisorVisit) => (
  'taskCount' in visit ? visit.taskCount : Object.keys(visit.payload?.tasks || {}).length
);

const getVisitDuration = (visit: SupervisorVisit) => {
  const checkIn = visit.payload?.checkInTime ? new Date(visit.payload.checkInTime).getTime() : null;
  const checkOut = visit.payload?.checkOutTime ? new Date(visit.payload.checkOutTime).getTime() : null;
  if (!checkIn || !checkOut || Number.isNaN(checkIn) || Number.isNaN(checkOut) || checkOut < checkIn) {
    return null;
  }
  return checkOut - checkIn;
};

const getBrasiliaHour = (value: string) => {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(new Date(value));

  return Number(hour);
};

const getRouteVisitStatus = (visit: SupervisorVisit) => {
  if (visit.syncStatus === 'enviado' && visit.payload?.checkOutTime) return 'CONCLUÍDO';
  if (visit.syncStatus === 'enviando') return 'EM ANDAMENTO';
  return 'PENDENTE';
};

const getAverageDuration = (visits: SupervisorVisit[]) => {
  const durations = visits
    .map(getVisitDuration)
    .filter((duration): duration is number => typeof duration === 'number');

  if (durations.length === 0) return '--:--';
  const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return formatDuration(average);
};

const getLastVisitTime = (visit: SupervisorVisit | undefined) => {
  if (!visit) return null;
  return visit.updatedAt || visit.createdAt || null;
};

const normalizeStoreIdentity = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

const getVisitStoreAliases = (visit: SupervisorVisit) => [
  visit.payload?.currentStoreId || visit.payload?.storeId
    ? `id:${String(visit.payload.currentStoreId || visit.payload.storeId).trim()}`
    : '',
  normalizeStoreIdentity(visit.payload?.currentStore)
    ? `name:${normalizeStoreIdentity(visit.payload.currentStore)}`
    : '',
].filter(Boolean);

const buildRouteProgress = (plannedStores: PlannedStore[], todayVisits: SupervisorVisit[]) => {
  const plannedByAlias = new Map<string, string>();
  plannedStores.forEach((store) => {
    const canonical = `planned:${store.id}`;
    plannedByAlias.set(`id:${store.id}`, canonical);
    const normalizedName = normalizeStoreIdentity(store.name);
    if (normalizedName) plannedByAlias.set(`name:${normalizedName}`, canonical);
  });

  const completedPlanned = new Set<string>();
  const distinctRecorded = new Set<string>();
  const distinctExtra = new Set<string>();

  todayVisits.forEach((visit) => {
    const aliases = getVisitStoreAliases(visit);
    const plannedKey = aliases.map((alias) => plannedByAlias.get(alias)).find(Boolean);
    const recordedKey = plannedKey || aliases[0] || `visit:${visit.visitId}`;
    distinctRecorded.add(recordedKey);
    if (!plannedKey) distinctExtra.add(recordedKey);
    if (plannedKey && visit.syncStatus === 'enviado' && visit.payload?.checkOutTime) {
      completedPlanned.add(plannedKey);
    }
  });

  return {
    planned: plannedStores.length,
    completed: completedPlanned.size,
    pending: Math.max(0, plannedStores.length - completedPlanned.size),
    recorded: todayVisits.length,
    extra: distinctExtra.size,
    duplicates: Math.max(0, todayVisits.length - distinctRecorded.size),
  };
};

const buildPromoterOverview = (
  promoter: AppData['promoters'][number],
  promoterVisits: SupervisorVisit[],
  plannedStores: PlannedStore[],
  dateKey: string,
  registered: boolean,
  nowMs: number,
) => {
  const orderedVisits = [...promoterVisits].sort((left, right) => {
    const leftTime = new Date(getTimestamp(left)).getTime();
    const rightTime = new Date(getTimestamp(right)).getTime();
    return leftTime - rightTime;
  });

  const todayVisits = orderedVisits.filter((visit) => isVisitFromDate(visit, dateKey));
  const latestToday = todayVisits.at(-1);
  const latest = latestToday || orderedVisits.at(-1);
  const latestTime = getLastVisitTime(latest);
  const completed = orderedVisits.filter((visit) => visit.syncStatus === 'enviado' && visit.payload?.checkOutTime).length;
  const pendingSyncVisits = orderedVisits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const online = Boolean(latestTime && (nowMs - new Date(latestTime).getTime()) < 15 * 60 * 1000);
  const routeProgress = buildRouteProgress(plannedStores, todayVisits);
  const registrationStatus: SupervisorPromoterOverview['registrationStatus'] =
    promoter.status === 'INATIVO' ? 'INATIVO' : 'ATIVO';

  const status: SupervisorPromoterOverview['status'] = registrationStatus === 'INATIVO'
    ? 'INATIVO'
    : latestToday?.syncStatus === 'enviando'
    ? 'EM ANDAMENTO'
    : routeProgress.planned > 0 && routeProgress.completed === routeProgress.planned
      ? 'CONCLUÍDO'
      : routeProgress.planned > 0 || todayVisits.length > 0
        ? 'PENDENTE'
        : 'SEM ATIVIDADE';

  return {
    id: promoter.id,
    name: promoter.name,
    user: promoter.user,
    region: promoter.region,
    phone: promoter.phone || '',
    registered,
    registrationStatus,
    activeToday: todayVisits.length > 0,
    hasRouteToday: plannedStores.length > 0,
    status,
    online: registrationStatus === 'ATIVO' && online,
    progress: routeProgress.planned === 0
      ? 0
      : Math.min(100, Math.round((routeProgress.completed / routeProgress.planned) * 100)),
    store: latest?.payload?.currentStore || 'Sem loja recente',
    lastSync: latestTime
      ? formatBrasiliaTime(latestTime)
      : '--:--',
    visits: {
      completed,
      total: orderedVisits.length,
    },
    todayVisits: {
      completed: routeProgress.completed,
      pending: routeProgress.pending,
      total: routeProgress.planned,
      recorded: routeProgress.recorded,
      extra: routeProgress.extra,
      duplicates: routeProgress.duplicates,
    },
    pendingSyncVisits,
    lastVisitId: latest?.visitId || null,
  };
};

const buildTimeline = (visits: SupervisorVisit[]) => {
  const labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
  const timeline = labels.map((time) => ({
    time,
    totalVisits: 0,
    completedVisits: 0,
    pendingSyncVisits: 0,
  }));

  for (const visit of visits) {
    const timestamp = getTimestamp(visit);
    if (!timestamp) continue;

    const hour = getBrasiliaHour(timestamp);
    const bucketIndex = Math.min(5, Math.max(0, Math.floor((hour - 8) / 2)));
    const bucket = timeline[bucketIndex];
    bucket.totalVisits += 1;

    if (visit.syncStatus === 'enviado' && visit.payload?.checkOutTime) {
      bucket.completedVisits += 1;
    } else if (pendingSyncStatuses.has(visit.syncStatus)) {
      bucket.pendingSyncVisits += 1;
    }
  }

  return timeline;
};

const buildAverageDuration = (visits: SupervisorVisit[]) => getAverageDuration(visits.filter((visit) => visit.syncStatus === 'enviado'));

export const buildSupervisorDashboard = (
  data: AppData,
  visits: SupervisorVisit[],
  now = new Date(),
): SupervisorDashboardResponse => {
  const dateKey = getBrasiliaDateKey(now);
  const todayVisits = visits.filter((visit) => isVisitFromDate(visit, dateKey));
  const byPromoter = new Map<string, SupervisorVisit[]>();
  const promoterByIdentity = new Map<string, AppData['promoters'][number]>();
  const fieldPromoters = data.promoters.filter((promoter) => promoter.role !== 'SUPERVISOR');

  fieldPromoters.forEach((promoter) => {
    promoterByIdentity.set(normalizeIdentity(promoter.id), promoter);
    promoterByIdentity.set(normalizeIdentity(promoter.user), promoter);
  });

  for (const visit of visits) {
    const ownerKeys = getVisitOwnerKeys(visit);
    const registered = ownerKeys.map((key) => promoterByIdentity.get(key)).find(Boolean);
    const promoterId = registered?.id || ownerKeys[0] || 'historico-desconhecido';
    const current = byPromoter.get(promoterId) || [];
    current.push(visit);
    byPromoter.set(promoterId, current);
  }

  const registeredIds = new Set(fieldPromoters.map((promoter) => promoter.id));
  const historicalPromoters = Array.from(byPromoter.entries())
    .filter(([id]) => !registeredIds.has(id))
    .map(([id, promoterVisits]) => {
      const latest = [...promoterVisits].sort((left, right) => (
        new Date(getTimestamp(right)).getTime() - new Date(getTimestamp(left)).getTime()
      ))[0];
      return {
        id,
        name: String(latest?.payload?.user?.name || `Usuario historico ${id}`),
        user: String(latest?.payload?.user?.user || id),
        pass: '',
        region: String(latest?.payload?.user?.region || 'Historico'),
        phone: '',
      };
    });
  const knownRouteIds = new Set(fieldPromoters.map((promoter) => promoter.id));
  const knownRouteNames = new Set(fieldPromoters.map((promoter) => normalizeStoreIdentity(promoter.name)));
  const routeOnlyById = new Map<string, AppData['promoters'][number]>();
  const weekday = getBrasiliaWeekday(now);
  data.stores
    .filter((store) => store.routeDays?.includes(weekday))
    .forEach((store) => {
      const normalizedResponsible = normalizeStoreIdentity(store.responsible);
      const routePromoterIds = store.routePromoterIds?.length
        ? store.routePromoterIds
        : (store.routePromoterId ? [store.routePromoterId] : []);
      routePromoterIds.forEach((routePromoterId, index) => {
        if (knownRouteIds.has(routePromoterId)) return;
        routeOnlyById.set(routePromoterId, {
          id: routePromoterId,
          name: index === 0 && store.responsible
            ? store.responsible
            : `Promotor nao cadastrado ${routePromoterId}`,
          user: '',
          pass: '',
          region: store.region,
        });
      });
      if (routePromoterIds.length === 0 && normalizedResponsible && !knownRouteNames.has(normalizedResponsible)) {
        const id = `rota-${normalizedResponsible.toLowerCase()}`;
        routeOnlyById.set(id, {
          id,
          name: store.responsible,
          user: '',
          pass: '',
          region: store.region,
        });
      }
    });
  const promoterSourcesById = new Map<string, AppData['promoters'][number]>();
  [...fieldPromoters, ...historicalPromoters, ...routeOnlyById.values()]
    .forEach((promoter) => {
      if (!promoterSourcesById.has(promoter.id)) promoterSourcesById.set(promoter.id, promoter);
    });
  const promoterSources = [...promoterSourcesById.values()];
  const promoters = promoterSources.map((promoter) => {
    const registered = registeredIds.has(promoter.id);
    const plannedStores = getStoresForUser(data, { ...promoter, role: 'FIELD_OPS' }, now);
    return buildPromoterOverview(
      promoter,
      byPromoter.get(promoter.id) || [],
      plannedStores,
      dateKey,
      registered,
      now.getTime(),
    );
  });
  const totalVisits = promoters.reduce((total, promoter) => total + promoter.todayVisits.total, 0);
  const completedVisits = promoters.reduce((total, promoter) => total + promoter.todayVisits.completed, 0);
  const pendingVisits = promoters.reduce((total, promoter) => total + promoter.todayVisits.pending, 0);
  const recordedVisits = promoters.reduce((total, promoter) => total + promoter.todayVisits.recorded, 0);
  const extraVisits = promoters.reduce((total, promoter) => total + promoter.todayVisits.extra, 0);
  const duplicateVisits = promoters.reduce((total, promoter) => total + promoter.todayVisits.duplicates, 0);
  const pendingSyncVisits = visits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const registeredPromoters = promoters.filter((promoter) => promoter.registered);
  const activeRegisteredPromoters = registeredPromoters.filter((promoter) => promoter.registrationStatus === 'ATIVO');
  const onlinePromoters = activeRegisteredPromoters.filter((promoter) => promoter.online).length;
  const activeTodayPromoters = promoters.filter((promoter) => promoter.activeToday).length;
  const summary: SupervisorDashboardSummary = {
    totalPromoters: registeredPromoters.length,
    activePromoters: activeRegisteredPromoters.length,
    inactivePromoters: registeredPromoters.length - activeRegisteredPromoters.length,
    onlinePromoters,
    offlinePromoters: activeRegisteredPromoters.length - onlinePromoters,
    onRoutePromoters: promoters.filter((promoter) => promoter.hasRouteToday).length,
    activeTodayPromoters,
    inProgressPromoters: promoters.filter((promoter) => promoter.status === 'EM ANDAMENTO').length,
    completedPromoters: promoters.filter((promoter) => promoter.todayVisits.completed > 0).length,
    pendingPromoters: promoters.filter((promoter) => promoter.todayVisits.pending > 0).length,
    pendingSyncVisits,
    pendingSyncPromoters: promoters.filter((promoter) => promoter.pendingSyncVisits > 0).length,
    totalVisits,
    completedVisits,
    pendingVisits,
    recordedVisits,
    extraVisits,
    duplicateVisits,
    averageVisitTime: buildAverageDuration(todayVisits),
    lastUpdated: visits.reduce((latest, visit) => {
      const timestamp = visit.updatedAt || visit.createdAt;
      return timestamp && timestamp > latest ? timestamp : latest;
    }, data.timestamp || ''),
  };

  return {
    summary,
    timeline: buildTimeline(todayVisits),
    promoters,
    lastUpdated: summary.lastUpdated,
  };
};

export const buildSupervisorPromoterDetail = (
  visits: SupervisorVisit[],
  profile?: Partial<AppData['promoters'][number]> & { registered?: boolean },
  now = new Date(),
  plannedStores: PlannedStore[] = [],
): SupervisorPromoterDetailResponse => {
  const orderedVisits = [...visits].sort((left, right) => {
    const leftTime = new Date(getTimestamp(left)).getTime();
    const rightTime = new Date(getTimestamp(right)).getTime();
    return leftTime - rightTime;
  });
  const dateKey = getBrasiliaDateKey(now);
  const todayVisits = orderedVisits.filter((visit) => isVisitFromDate(visit, dateKey));
  const latestUser = orderedVisits.at(-1)?.payload?.user || {};

  const pendingSyncVisits = todayVisits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const averageDuration = getAverageDuration(todayVisits);
  const routeProgress = buildRouteProgress(plannedStores, todayVisits);

  return {
    profile: {
      id: String(profile?.id || latestUser.id || ''),
      name: String(profile?.name || latestUser.name || 'Promotor'),
      user: String(profile?.user || latestUser.user || ''),
      region: String(profile?.region || latestUser.region || ''),
      phone: String(profile?.phone || ''),
      registered: profile?.registered !== false,
      registrationStatus: profile?.status === 'INATIVO' ? 'INATIVO' : 'ATIVO',
    },
    metrics: {
      efficiency: routeProgress.planned
        ? `${Math.min(100, Math.round((routeProgress.completed / routeProgress.planned) * 100))}%`
        : '0%',
      workingTime: averageDuration,
      completedVisits: routeProgress.completed,
      totalVisits: routeProgress.planned,
      pendingSyncVisits,
      averageDuration,
    },
    route: orderedVisits.slice(-10).reverse().map((visit, index) => ({
      id: `${visit.visitId}-${index}`,
      visitId: visit.visitId,
      name: visit.payload?.currentStore || 'Loja sem nome',
      time: formatBrasiliaTime(getTimestamp(visit)),
      date: formatBrasiliaDate(getTimestamp(visit)),
      status: getRouteVisitStatus(visit),
      tasks: countVisitTasks(visit),
      photos: countVisitPhotos(visit),
      syncStatus: visit.syncStatus,
    })),
  };
};
