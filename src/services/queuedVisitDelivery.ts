import { getQueuedVisit, updateQueuedVisit } from './syncQueue.ts';
import { confirmQueuedVisit } from './confirmQueuedVisit.ts';
import { submitAutomaticVisit } from './submitAutomaticVisit.ts';
import { classifyQueuedSyncFailure } from './syncPolicy.ts';

type Transport = Parameters<typeof submitAutomaticVisit>[2];
const inFlight = new Map<string, Promise<'sent' | 'syncing' | 'missing'>>();

// A manual click and an automatic resume must share one upload, never replace
// a server record or remove a local payload before the server confirms it.
export const deliverQueuedVisit = (ownerId: string, visitId: string, transport: Transport, currentOwner: () => string | null) => {
  const key = `${ownerId}:${visitId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const requireOwner = () => {
    if (currentOwner() !== ownerId) throw new Error('A sessao mudou. O envio foi preservado.');
  };
  const operation = (async () => {
    requireOwner();
    const queued = await getQueuedVisit(ownerId, visitId);
    if (!queued) return 'missing' as const;
    try {
      const result = await submitAutomaticVisit(visitId, queued.payload, {
        status: id => { requireOwner(); return transport.status(id); },
        create: payload => { requireOwner(); return transport.create(payload); },
        start: id => { requireOwner(); return transport.start(id); },
      });
      requireOwner();
      if (result === 'sent') await confirmQueuedVisit(ownerId, visitId, 'enviado');
      else await updateQueuedVisit(ownerId, visitId, { status: 'syncing', error: null });
      return result;
    } catch (error: any) {
      if (currentOwner() === ownerId) {
        const failure = classifyQueuedSyncFailure(error);
        const transient = [429, 500, 502, 503, 504].includes(error?.status);
        await updateQueuedVisit(ownerId, visitId, {
          status: transient ? 'pending' : failure.status,
          error: transient ? 'Servidor temporariamente indisponivel. O envio sera retomado automaticamente.' : failure.message,
          attempts: queued.attempts + 1,
        });
      }
      throw error;
    }
  })().finally(() => { inFlight.delete(key); });
  inFlight.set(key, operation);
  return operation;
};

export const isQueuedVisitUploading = (ownerId: string, visitId: string) => inFlight.has(`${ownerId}:${visitId}`);
