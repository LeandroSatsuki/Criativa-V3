type RouteStore = {
  id: string;
  responsible: string;
  routePromoterId?: string;
  routeDays?: number[];
};

type RoutePromoter = {
  id: string;
  name: string;
};

type RouteUser = {
  id: string;
  name: string;
  role: 'FIELD_OPS' | 'SUPERVISOR';
  storeResponsible?: string;
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
  const promoterName = user.storeResponsible || promoter?.name || user.name || '';
  const normalizedPromoterName = normalizeAssignment(promoterName);
  const weekday = getBrasiliaWeekday(now);

  return allStores.filter((store) => {
    const assignedById = Boolean(store.routePromoterId) && store.routePromoterId === user.id;
    const assignedByName = !store.routePromoterId &&
      normalizeAssignment(store.responsible) === normalizedPromoterName;
    return (assignedById || assignedByName) && store.routeDays?.includes(weekday);
  });
};
