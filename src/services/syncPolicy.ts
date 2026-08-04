import type { QueueStatus } from './syncQueue';
import { isNetworkRequestFailure } from './networkStatus.ts';

export type QueuedSyncFailure = {
  status: QueueStatus;
  message: string;
  releaseVisit: boolean;
};

export const classifyQueuedSyncFailure = (
  error: unknown,
  online?: boolean,
): QueuedSyncFailure => {
  if (isNetworkRequestFailure(error, online)) {
    return {
      status: 'pending',
      message: 'Sem conexão. Visita salva no aparelho e aguardando envio.',
      releaseVisit: true,
    };
  }

  return {
    status: 'error',
    message: error instanceof Error ? error.message : 'Falha na sincronização',
    releaseVisit: false,
  };
};
