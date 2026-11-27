import type { VisitState } from '../types.ts';
import { getQueuedVisit, upsertQueuedVisit } from './syncQueue.ts';

const evidence = (value: any, into = new Set<string>()): Set<string> => {
  if (typeof value === 'string' && value) into.add(value);
  else if (Array.isArray(value)) value.forEach(item => evidence(item, into));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => evidence(item, into));
  return into;
};
const photosOf = (state: any) => evidence({
  photos: state.photos, returns: state.returnsPhotosByIndustry,
  industries: Object.values(state.industryExecutions || {}).map((item: any) => item.photos),
});

export const isConfirmedCheckout = (state: Partial<VisitState>) => Boolean(
  state.visitId && state.checkOutTime && Number.isFinite(Date.parse(state.checkOutTime))
  && state.tasks?.CHECKOUT && state.photos?.CHECKOUT?.length,
);

export const preserveCompletedVisit = async (ownerId: string, snapshot: VisitState) => {
  if (!ownerId || String(snapshot.user?.id) !== ownerId || !isConfirmedCheckout(snapshot)) {
    throw new Error('A visita ainda nao tem saida confirmada. O rascunho foi preservado.');
  }
  const existing = await getQueuedVisit(ownerId, snapshot.visitId!);
  if (existing) {
    const currentPhotos = photosOf(snapshot), savedPhotos = photosOf(existing.payload);
    if ([...currentPhotos].every(photo => savedPhotos.has(photo)) && isConfirmedCheckout(existing.payload)) return existing;
    // Never replace a richer queue payload with a smaller restored draft.
    if (![...savedPhotos].every(photo => currentPhotos.has(photo))) {
      throw new Error('Existem fotos diferentes no rascunho e na fila. Ambas as copias foram preservadas para suporte.');
    }
  }
  return upsertQueuedVisit(ownerId, snapshot, snapshot.visitId!, 'pending');
};
