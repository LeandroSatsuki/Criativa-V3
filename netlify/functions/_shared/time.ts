export const getBrasiliaDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * -3));
};

export const getBrasiliaISO = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now).replace(' ', 'T');
};

export const formatBrasiliaTime = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatBrasiliaDate = (dateStr: string | undefined) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
};

export const formatFileDate = (dateStr: string | undefined) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
};
