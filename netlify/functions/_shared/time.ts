export const getBrasiliaDate = () => {
  return new Date();
};

const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_WITHOUT_ZONE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

const getBrasiliaParts = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', {
    timeZone: BRASILIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]),
);

const getBrasiliaOffset = (date: Date, parts: Record<string, string>) => {
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const instantWithoutMilliseconds = date.getTime() - date.getMilliseconds();
  const offsetMinutes = Math.round((representedAsUtc - instantWithoutMilliseconds) / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
  const minutes = String(absoluteMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
};

export const getBrasiliaISO = () => {
  const now = new Date();
  const parts = getBrasiliaParts(now);
  const localDateTime = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  return `${localDateTime}${getBrasiliaOffset(now, parts)}`;
};

export const parseBrasiliaDate = (dateStr: string | undefined) => {
  if (!dateStr) return new Date(Number.NaN);

  const normalized = dateStr.trim().replace(' ', 'T');
  if (DATE_ONLY_PATTERN.test(normalized)) {
    return new Date(`${normalized}T00:00:00-03:00`);
  }
  if (DATE_TIME_WITHOUT_ZONE_PATTERN.test(normalized)) {
    // Compatibility for drafts and queues saved before timezone-aware capture.
    return new Date(`${normalized}-03:00`);
  }
  return new Date(normalized);
};

export const formatBrasiliaTime = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const date = parseBrasiliaDate(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', {
    timeZone: BRASILIA_TIME_ZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatBrasiliaDate = (dateStr: string | undefined) => {
  const date = dateStr ? parseBrasiliaDate(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    timeZone: BRASILIA_TIME_ZONE,
  });
};

export const formatFileDate = (dateStr: string | undefined) => {
  const date = dateStr ? parseBrasiliaDate(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const parts = getBrasiliaParts(date);
  return `${parts.day}-${parts.month}-${parts.year}`;
};
