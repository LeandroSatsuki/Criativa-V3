import { getQueuedVisit, removeQueuedVisit } from './syncQueue.ts';
import { markPhotosConfirmed, hasLocalPhotos } from './litePhotos.ts';
import { createSingleFlight } from './singleFlight.ts';

const confirmations = createSingleFlight<void>();

export const confirmQueuedVisit = (ownerId: string, visitId: string, status: string): Promise<void> => {
  if (status !== 'enviado') return Promise.reject(new Error('O envio ainda nao foi confirmado.'));
  return confirmations(`${ownerId}:${visitId}`, async () => {
    const queued = await getQueuedVisit(ownerId, visitId);
    if (queued && hasLocalPhotos(queued.payload)) await markPhotosConfirmed(ownerId, visitId, queued.payload);
    await removeQueuedVisit(ownerId, visitId);
  });
};
