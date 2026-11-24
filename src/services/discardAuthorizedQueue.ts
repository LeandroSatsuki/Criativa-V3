import { canDiscardAuthorizedVisit, markAuthorizedVisitDiscarded } from './authorizedQueueDiscard.ts';
import { archiveAbandonedQueue } from './visitStorage.ts';
import { getQueuedVisit, removeQueuedVisit } from './syncQueue.ts';
import { isQueuedVisitUploading } from './queuedVisitDelivery.ts';

export const discardAuthorizedQueue = async (
  user: { id: string; user: string }, visitId: string,
  currentOwner: () => string | null,
) => {
  if (!canDiscardAuthorizedVisit(user, visitId) || currentOwner() !== user.id) throw new Error('Remocao nao autorizada para este registro.');
  if (isQueuedVisitUploading(user.id, visitId)) throw new Error('Aguarde a tentativa de envio terminar antes de remover a pendencia antiga.');
  const queued = await getQueuedVisit(user.id, visitId);
  if (!queued) return;
  await archiveAbandonedQueue(user.id, visitId, queued);
  if (currentOwner() !== user.id) throw new Error('A sessao mudou. A fila foi preservada.');
  markAuthorizedVisitDiscarded(user, visitId);
  await removeQueuedVisit(user.id, visitId);
};
