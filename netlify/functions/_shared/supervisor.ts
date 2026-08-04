import type { AppData } from './data';
import type { VisitRecord } from './visits';
import { formatBrasiliaDate, formatBrasiliaTime } from './time.ts';

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
  activeToday: boolean;
  status: 'CONCLUÍDO' | 'EM ANDAMENTO' | 'PENDENTE' | 'SEM ATIVIDADE';
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
  };
  pendingSyncVisits: number;
  lastVisitId: string | null;
};

export type SupervisorDashboardSummary = {
  totalPromoters: number;
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

const getTimestamp = (visit: VisitRecord) =>
  visit.payload?.checkInTime || visit.payload?.checkOutTime || visit.updatedAt || visit.createdAt;

const getBrasiliaDateKey = (value: string | Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(typeof value === 'string' ? new Date(value) : value);

const isVisitFromDate = (visit: VisitRecord, dateKey: string) => {
  const timestamp = getTimestamp(visit);
  return Boolean(timestamp && getBrasiliaDateKey(timestamp) === dateKey);
};

const normalizeIdentity = (value: unknown) => String(value || '').toLowerCase().trim();

const getVisitOwnerKeys = (visit: VisitRecord) => [
  normalizeIdentity(visit.payload?.user?.id),
  normalizeIdentity(visit.payload?.user?.user),
].filter(Boolean);

const countVisitPhotos = (visit: VisitRecord) => {
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

const getVisitDuration = (visit: VisitRecord) => {
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

const getVisitStatus = (visit: VisitRecord) => {
  if (visit.syncStatus === 'enviado' && visit.payload?.checkOutTime) return 'CONCLUÍDO';
  if (visit.syncStatus === 'enviando') return 'EM ANDAMENTO';
  return 'PENDENTE';
};

const getRouteVisitStatus = (visit: VisitRecord) => {
  if (visit.syncStatus === 'enviado' && visit.payload?.checkOutTime) return 'CONCLUÍDO';
  if (visit.syncStatus === 'enviando') return 'EM ANDAMENTO';
  return 'PENDENTE';
};

const getAverageDuration = (visits: VisitRecord[]) => {
  const durations = visits
    .map(getVisitDuration)
    .filter((duration): duration is number => typeof duration === 'number');

  if (durations.length === 0) return '--:--';
  const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return formatDuration(average);
};

const getLastVisitTime = (visit: VisitRecord | undefined) => {
  if (!visit) return null;
  return visit.updatedAt || visit.createdAt || null;
};

const buildPromoterOverview = (
  promoter: AppData['promoters'][number],
  promoterVisits: VisitRecord[],
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
  const completedToday = todayVisits.filter((visit) => visit.syncStatus === 'enviado' && visit.payload?.checkOutTime).length;
  const pendingToday = todayVisits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const online = Boolean(latestTime && (nowMs - new Date(latestTime).getTime()) < 15 * 60 * 1000);

  const status: SupervisorPromoterOverview['status'] = latest
    ? latestToday
      ? getVisitStatus(latestToday)
      : 'SEM ATIVIDADE'
    : 'SEM ATIVIDADE';

  return {
    id: promoter.id,
    name: promoter.name,
    user: promoter.user,
    region: promoter.region,
    phone: promoter.phone || '',
    registered,
    activeToday: todayVisits.length > 0,
    status,
    online,
    progress: todayVisits.length === 0 ? 0 : Math.min(100, Math.round((completedToday / todayVisits.length) * 100)),
    store: latest?.payload?.currentStore || 'Sem loja recente',
    lastSync: latestTime
      ? formatBrasiliaTime(latestTime)
      : '--:--',
    visits: {
      completed,
      total: orderedVisits.length,
    },
    todayVisits: {
      completed: completedToday,
      pending: pendingToday,
      total: todayVisits.length,
    },
    pendingSyncVisits,
    lastVisitId: latest?.visitId || null,
  };
};

const buildTimeline = (visits: VisitRecord[]) => {
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

const buildAverageDuration = (visits: VisitRecord[]) => getAverageDuration(visits.filter((visit) => visit.syncStatus === 'enviado'));

export const buildSupervisorDashboard = (
  data: AppData,
  visits: VisitRecord[],
  now = new Date(),
): SupervisorDashboardResponse => {
  const dateKey = getBrasiliaDateKey(now);
  const todayVisits = visits.filter((visit) => isVisitFromDate(visit, dateKey));
  const byPromoter = new Map<string, VisitRecord[]>();
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
  const promoterSources = [...fieldPromoters, ...historicalPromoters];
  const promoters = promoterSources.map((promoter) => buildPromoterOverview(
    promoter,
    byPromoter.get(promoter.id) || [],
    dateKey,
    registeredIds.has(promoter.id),
    now.getTime(),
  ));
  const totalVisits = todayVisits.length;
  const completedVisits = todayVisits.filter((visit) => visit.syncStatus === 'enviado' && visit.payload?.checkOutTime).length;
  const pendingVisits = todayVisits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const pendingSyncVisits = visits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const registeredPromoters = promoters.filter((promoter) => promoter.registered);
  const onlinePromoters = registeredPromoters.filter((promoter) => promoter.online).length;
  const activeTodayPromoters = promoters.filter((promoter) => promoter.activeToday).length;
  const summary: SupervisorDashboardSummary = {
    totalPromoters: registeredPromoters.length,
    onlinePromoters,
    offlinePromoters: registeredPromoters.length - onlinePromoters,
    onRoutePromoters: activeTodayPromoters,
    activeTodayPromoters,
    inProgressPromoters: promoters.filter((promoter) => promoter.status === 'EM ANDAMENTO').length,
    completedPromoters: promoters.filter((promoter) => promoter.todayVisits.completed > 0).length,
    pendingPromoters: promoters.filter((promoter) => promoter.todayVisits.pending > 0).length,
    pendingSyncVisits,
    pendingSyncPromoters: promoters.filter((promoter) => promoter.pendingSyncVisits > 0).length,
    totalVisits,
    completedVisits,
    pendingVisits,
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
  visits: VisitRecord[],
  profile?: Partial<AppData['promoters'][number]> & { registered?: boolean },
  now = new Date(),
): SupervisorPromoterDetailResponse => {
  const orderedVisits = [...visits].sort((left, right) => {
    const leftTime = new Date(getTimestamp(left)).getTime();
    const rightTime = new Date(getTimestamp(right)).getTime();
    return leftTime - rightTime;
  });
  const dateKey = getBrasiliaDateKey(now);
  const todayVisits = orderedVisits.filter((visit) => isVisitFromDate(visit, dateKey));
  const latestUser = orderedVisits.at(-1)?.payload?.user || {};

  const completedVisits = todayVisits.filter((visit) => visit.syncStatus === 'enviado' && visit.payload?.checkOutTime).length;
  const pendingSyncVisits = todayVisits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const averageDuration = getAverageDuration(todayVisits);

  return {
    profile: {
      id: String(profile?.id || latestUser.id || ''),
      name: String(profile?.name || latestUser.name || 'Promotor'),
      user: String(profile?.user || latestUser.user || ''),
      region: String(profile?.region || latestUser.region || ''),
      phone: String(profile?.phone || ''),
      registered: profile?.registered !== false,
    },
    metrics: {
      efficiency: todayVisits.length
        ? `${Math.min(100, Math.round((completedVisits / todayVisits.length) * 100))}%`
        : '0%',
      workingTime: averageDuration,
      completedVisits,
      totalVisits: todayVisits.length,
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
      tasks: Object.keys(visit.payload?.tasks || {}).length,
      photos: countVisitPhotos(visit),
      syncStatus: visit.syncStatus,
    })),
  };
};
