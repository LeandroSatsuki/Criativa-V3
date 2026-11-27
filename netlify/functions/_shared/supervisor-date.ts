const brasiliaDateKey = (value: Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(value);

export const resolveSupervisorDate = (rawDate: string | null, now = new Date()) => {
  const today = brasiliaDateKey(now);
  const date = rawDate || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const selected = new Date(`${date}T12:00:00-03:00`);
  if (!Number.isFinite(selected.getTime()) || brasiliaDateKey(selected) !== date || date > today) return null;
  return { date, selected, historical: date !== today };
};
