import type { SupervisorPromoterOverview } from '../types';

export type SupervisorFilter =
  | 'all'
  | 'active'
  | 'completed'
  | 'sync_pending'
  | 'on_route'
  | 'in_progress'
  | 'pending'
  | 'offline'
  | 'duration';

const normalizeSearch = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const filterSupervisorPromoters = (
  promoters: SupervisorPromoterOverview[],
  filter: SupervisorFilter,
  search = '',
) => {
  const normalizedSearch = normalizeSearch(search);

  return promoters.filter((promoter) => {
    const matchesFilter = (() => {
      if (filter === 'all') return true;
      if (filter === 'active') return promoter.registered;
      if (filter === 'completed' || filter === 'duration') return promoter.todayVisits.completed > 0;
      if (filter === 'sync_pending') return promoter.pendingSyncVisits > 0;
      if (filter === 'on_route') return promoter.activeToday;
      if (filter === 'in_progress') return promoter.status === 'EM ANDAMENTO';
      if (filter === 'pending') return promoter.todayVisits.pending > 0;
      if (filter === 'offline') return promoter.registered && !promoter.online;
      return true;
    })();

    if (!matchesFilter || !normalizedSearch) return matchesFilter;

    return [promoter.name, promoter.id, promoter.user, promoter.region, promoter.phone, promoter.store]
      .some((value) => normalizeSearch(value).includes(normalizedSearch));
  });
};
