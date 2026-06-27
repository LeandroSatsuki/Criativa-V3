export const generateVisitId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `VISIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  return `VISIT-${Date.now().toString(36).toUpperCase()}`;
};
