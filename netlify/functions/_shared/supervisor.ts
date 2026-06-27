import type { AppData } from './data';
import type { VisitRecord } from './visits';
import { formatBrasiliaTime } from './time';

export type SupervisorTimelinePoint = {
  time: string;
  totalVisits: number;
  completedVisits: number;
  pendingSyncVisits: number;
};

export type SupervisorPromoterOverview = {
  id: string;
  name: string;
  region: string;
  status: 'CONCLUÍDO' | 'EM ANDAMENTO' | 'PENDENTE' | 'EM ROTA';
  online: boolean;
  progress: number;
  store: string;
  lastSync: string;
  visits: {
    completed: number;
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
  inProgressPromoters: number;
  completedPromoters: number;
  pendingPromoters: number;
  pendingSyncVisits: number;
  totalVisits: number;
  completedVisits: number;
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
  status: 'CONCLUÍDO' | 'EM ANDAMENTO' | 'PENDENTE';
  tasks: number;
  photos: number;
  syncStatus: VisitRecord['syncStatus'];
};

export type SupervisorPromoterDetailResponse = {
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

const getVisitStatus = (visit: VisitRecord, isOnline: boolean) => {
  if (visit.syncStatus === 'enviado' && visit.payload?.checkOutTime) return 'CONCLUÍDO';
  if (visit.syncStatus === 'enviando') return 'EM ANDAMENTO';
  if (pendingSyncStatuses.has(visit.syncStatus)) return 'PENDENTE';
  return isOnline ? 'EM ROTA' : 'PENDENTE';
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

const buildPromoterOverview = (promoter: AppData['promoters'][number], promoterVisits: VisitRecord[]) => {
  const orderedVisits = [...promoterVisits].sort((left, right) => {
    const leftTime = new Date(getTimestamp(left)).getTime();
    const rightTime = new Date(getTimestamp(right)).getTime();
    return leftTime - rightTime;
  });

  const latest = orderedVisits.at(-1);
  const latestTime = getLastVisitTime(latest);
  const completed = orderedVisits.filter((visit) => visit.syncStatus === 'enviado' && visit.payload?.checkOutTime).length;
  const pendingSyncVisits = orderedVisits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const online = Boolean(latestTime && (Date.now() - new Date(latestTime).getTime()) < 15 * 60 * 1000);

  const status: SupervisorPromoterOverview['status'] = latest
    ? getVisitStatus(latest, online)
    : online
      ? 'EM ROTA'
      : 'PENDENTE';

  return {
    id: promoter.id,
    name: promoter.name,
    region: promoter.region,
    status,
    online,
    progress: orderedVisits.length === 0 ? 0 : Math.min(100, Math.round((completed / orderedVisits.length) * 100)),
    store: latest?.payload?.currentStore || 'Sem loja recente',
    lastSync: latestTime
      ? formatBrasiliaTime(latestTime)
      : '--:--',
    visits: {
      completed,
      total: orderedVisits.length,
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

export const buildSupervisorDashboard = (data: AppData, visits: VisitRecord[]): SupervisorDashboardResponse => {
  const byPromoter = new Map<string, VisitRecord[]>();

  for (const visit of visits) {
    const promoterId = String(visit.payload?.user?.id || visit.payload?.user?.user || 'unknown');
    const current = byPromoter.get(promoterId) || [];
    current.push(visit);
    byPromoter.set(promoterId, current);
  }

  const promoters = data.promoters.map((promoter) => buildPromoterOverview(promoter, byPromoter.get(promoter.id) || []));
  const totalVisits = visits.length;
  const completedVisits = visits.filter((visit) => visit.syncStatus === 'enviado' && visit.payload?.checkOutTime).length;
  const pendingSyncVisits = visits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const onlinePromoters = promoters.filter((promoter) => promoter.online).length;
  const summary: SupervisorDashboardSummary = {
    totalPromoters: promoters.length,
    onlinePromoters,
    offlinePromoters: promoters.length - onlinePromoters,
    onRoutePromoters: promoters.filter((promoter) => promoter.status === 'EM ROTA').length,
    inProgressPromoters: promoters.filter((promoter) => promoter.status === 'EM ANDAMENTO').length,
    completedPromoters: promoters.filter((promoter) => promoter.status === 'CONCLUÍDO').length,
    pendingPromoters: promoters.filter((promoter) => promoter.status === 'PENDENTE').length,
    pendingSyncVisits,
    totalVisits,
    completedVisits,
    averageVisitTime: buildAverageDuration(visits),
    lastUpdated: data.timestamp || new Date().toISOString(),
  };

  return {
    summary,
    timeline: buildTimeline(visits),
    promoters,
    lastUpdated: summary.lastUpdated,
  };
};

export const buildSupervisorPromoterDetail = (visits: VisitRecord[]): SupervisorPromoterDetailResponse => {
  const orderedVisits = [...visits].sort((left, right) => {
    const leftTime = new Date(getTimestamp(left)).getTime();
    const rightTime = new Date(getTimestamp(right)).getTime();
    return leftTime - rightTime;
  });

  const completedVisits = orderedVisits.filter((visit) => visit.syncStatus === 'enviado' && visit.payload?.checkOutTime).length;
  const pendingSyncVisits = orderedVisits.filter((visit) => pendingSyncStatuses.has(visit.syncStatus)).length;
  const averageDuration = getAverageDuration(orderedVisits);

  return {
    metrics: {
      efficiency: orderedVisits.length
        ? `${Math.min(100, Math.round((completedVisits / orderedVisits.length) * 100))}%`
        : '0%',
      workingTime: averageDuration,
      completedVisits,
      totalVisits: orderedVisits.length,
      pendingSyncVisits,
      averageDuration,
    },
    route: orderedVisits.slice(-10).reverse().map((visit, index) => ({
      id: `${visit.visitId}-${index}`,
      visitId: visit.visitId,
      name: visit.payload?.currentStore || 'Loja sem nome',
      time: formatBrasiliaTime(getTimestamp(visit)),
      status: getRouteVisitStatus(visit),
      tasks: Object.keys(visit.payload?.tasks || {}).length,
      photos: Object.values(visit.payload?.photos || {}).flat().length,
      syncStatus: visit.syncStatus,
    })),
  };
};
