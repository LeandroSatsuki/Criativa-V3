import { isLocalPhoto, readLocalPhoto, LocalPhotoUnavailableError } from './litePhotos.ts';

export type LocalPhotoAudit = { total: number; readable: number; missing: number; differentOwner: number; unverified: number };

export const auditLocalVisitPhotos = async (ownerId: string, payload: any, currentOwner: () => string | null): Promise<LocalPhotoAudit> => {
  const photos = new Set<string>();
  const add = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const item of value) if (typeof item === 'string' && item) photos.add(item);
  };
  Object.values(payload?.photos || {}).forEach(add);
  Object.values(payload?.returnsPhotosByIndustry || {}).forEach(add);
  Object.values(payload?.industryExecutions || {}).forEach((execution: any) => Object.values(execution?.photos || {}).forEach(add));
  const report: LocalPhotoAudit = { total: photos.size, readable: 0, missing: 0, differentOwner: 0, unverified: 0 };
  for (const photo of photos) {
    if (currentOwner() !== ownerId) throw new Error('A sessao mudou. A conferencia foi interrompida.');
    if (!isLocalPhoto(photo)) { report.readable++; continue; }
    try {
      // One image at a time. Do not hydrate the entire queue or save a copy.
      await readLocalPhoto(ownerId, photo);
      report.readable++;
    } catch (error) {
      if (error instanceof LocalPhotoUnavailableError) {
        if (error.reason === 'missing') report.missing++;
        else report.differentOwner++;
      } else report.unverified++;
    }
  }
  if (currentOwner() !== ownerId) throw new Error('A sessao mudou. A conferencia foi interrompida.');
  return report;
};
