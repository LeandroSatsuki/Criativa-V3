type RouteStore = {
  id: string;
  responsible: string;
  routePromoterId?: string;
  routePromoterIds?: string[];
  routeDays?: number[];
};

type RoutePromoter = {
  id: string;
  name: string;
  status?: 'ATIVO' | 'INATIVO';
};

type RouteUser = {
  id: string;
  name: string;
  role: 'FIELD_OPS' | 'SUPERVISOR';
  storeResponsible?: string;
  status?: 'ATIVO' | 'INATIVO';
};

type RouteData<TStore extends RouteStore> = {
  promoters?: RoutePromoter[];
  stores?: TStore[];
};

const normalizeAssignment = (value: string | undefined) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

export const parseRoutePromoterIds = (...values: Array<string | undefined>) => Array.from(new Set(
  values
    .flatMap((value) => String(value || '').split(/[,;|\n]+/))
    .map((value) => value.trim())
    .filter(Boolean),
));

export const getBrasiliaWeekday = (now = new Date()) => {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
};

export const getStoresForUser = <TStore extends RouteStore>(
  data: RouteData<TStore>,
  user: RouteUser,
  now = new Date(),
) => {
  const promoters = data.promoters || [];
  const allStores = data.stores || [];

  if (user.id === '0' || user.role === 'SUPERVISOR') return allStores;

  const promoter = promoters.find((item) => item.id === user.id);
  if (user.status === 'INATIVO' || promoter?.status === 'INATIVO') return [];
  const promoterName = user.storeResponsible || promoter?.name || user.name || '';
  const normalizedPromoterName = normalizeAssignment(promoterName);
  const weekday = getBrasiliaWeekday(now);

  return allStores.filter((store) => {
    const assignedIds = parseRoutePromoterIds(store.routePromoterId, ...(store.routePromoterIds || []));
    const assignedById = assignedIds.includes(user.id);
    const assignedByName = assignedIds.length === 0 &&
      normalizeAssignment(store.responsible) === normalizedPromoterName;
    return (assignedById || assignedByName) && store.routeDays?.includes(weekday);
  });
};
