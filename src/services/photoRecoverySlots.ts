import { isLocalPhoto } from './litePhotos.ts';
export type MissingPhotoSlot = { photoId: string; section: string; industry: string; number: number };
export const photoRecoverySlots = (payload: any): MissingPhotoSlot[] => {
  const slots = new Map<string, MissingPhotoSlot>();
  const add = (photos: unknown, section: string, industry = '') => {
    if (!Array.isArray(photos)) return;
    photos.forEach((photoId, index) => {
      if (isLocalPhoto(photoId) && (!slots.has(photoId) || (!slots.get(photoId)!.industry && industry))) slots.set(photoId, { photoId, section, industry, number: index + 1 });
    });
  };
  Object.entries(payload?.photos || {}).forEach(([section, photos]) => add(photos, section));
  Object.entries(payload?.returnsPhotosByIndustry || {}).forEach(([industry, photos]) => add(photos, 'TROCAS', industry));
  Object.entries(payload?.industryExecutions || {}).forEach(([industry, execution]: [string, any]) => Object.entries(execution?.photos || {}).forEach(([section, photos]) => add(photos, section, industry)));
  return [...slots.values()];
};
