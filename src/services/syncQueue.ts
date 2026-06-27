export type QueueStatus = 'pending' | 'syncing' | 'error' | 'synced';

export type QueuedVisit = {
  visitId: string;
  payload: any;
  status: QueueStatus;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

const QUEUE_KEY = 'criativa_sync_queue';

const readQueue = (): QueuedVisit[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedVisit[]) : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: QueuedVisit[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `VISIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `VISIT-${Date.now().toString(36).toUpperCase()}`;
};

export const listQueuedVisits = () => readQueue();

export const getQueuedVisitCount = () => readQueue().length;

export const upsertQueuedVisit = (payload: any, visitId?: string, status: QueueStatus = 'pending') => {
  const queue = readQueue();
  const now = new Date().toISOString();
  const resolvedVisitId = visitId || payload.visitId || generateId();
  const existingIndex = queue.findIndex((item) => item.visitId === resolvedVisitId);
  const base: QueuedVisit = {
    visitId: resolvedVisitId,
    payload: { ...payload, visitId: resolvedVisitId },
    status,
    error: null,
    attempts: existingIndex >= 0 ? queue[existingIndex].attempts : 0,
    createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    queue[existingIndex] = base;
  } else {
    queue.unshift(base);
  }

  writeQueue(queue);
  return base;
};

export const updateQueuedVisit = (visitId: string, patch: Partial<QueuedVisit>) => {
  const queue = readQueue();
  const index = queue.findIndex((item) => item.visitId === visitId);
  if (index === -1) return null;

  queue[index] = {
    ...queue[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  writeQueue(queue);
  return queue[index];
};

export const removeQueuedVisit = (visitId: string) => {
  const queue = readQueue().filter((item) => item.visitId !== visitId);
  writeQueue(queue);
};

export const clearQueuedVisits = () => {
  writeQueue([]);
};

