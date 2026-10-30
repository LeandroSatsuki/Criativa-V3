import { getQueuedVisit, removeQueuedVisit } from './syncQueue.ts';
import { markPhotosConfirmed, hasLocalPhotos } from './litePhotos.ts';

export const confirmQueuedVisit = async (ownerId: string, visitId: string, status: string) => {
  if (status !== 'enviado') throw new Error('O envio ainda nao foi confirmado.');
  const queued = await getQueuedVisit(ownerId, visitId);
  if (queued && hasLocalPhotos(queued.payload)) await markPhotosConfirmed(ownerId, visitId, queued.payload);
  await removeQueuedVisit(ownerId, visitId);
};
