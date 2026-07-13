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

const LEGACY_QUEUE_KEY = 'criativa_sync_queue';
const DB_NAME = 'criativa-field-ops-sync';
const DB_VERSION = 1;
const STORE_NAME = 'queued-visits';

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB indisponivel neste navegador.'));
    return;
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onerror = () => reject(request.error || new Error('Falha ao abrir a fila local.'));
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'visitId' });
    }
  };
  request.onsuccess = () => resolve(request.result);
});

const readIndexedQueue = async () => {
  const database = await openDatabase();

  return new Promise<QueuedVisit[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onerror = () => reject(request.error || new Error('Falha ao ler a fila local.'));
    request.onsuccess = () => resolve((request.result as QueuedVisit[]).sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    transaction.oncomplete = () => database.close();
  });
};

const writeIndexedQueue = async (queue: QueuedVisit[]) => {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    queue.forEach((visit) => store.put(visit));
    transaction.onerror = () => reject(transaction.error || new Error('Falha ao salvar a fila local.'));
    transaction.onabort = () => reject(transaction.error || new Error('O salvamento da fila foi interrompido.'));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
};

const readLegacyQueue = (): QueuedVisit[] => {
  try {
    const raw = localStorage.getItem(LEGACY_QUEUE_KEY);
    return raw ? JSON.parse(raw) as QueuedVisit[] : [];
  } catch {
    return [];
  }
};

let migrationPromise: Promise<void> | null = null;

const migrateLegacyQueue = async () => {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const indexedQueue = await readIndexedQueue();
    if (indexedQueue.length > 0) {
      localStorage.removeItem(LEGACY_QUEUE_KEY);
      return;
    }

    const legacyQueue = readLegacyQueue();
    if (legacyQueue.length === 0) return;

    await writeIndexedQueue(legacyQueue);
    localStorage.removeItem(LEGACY_QUEUE_KEY);
  })();

  return migrationPromise;
};

let writeSequence: Promise<void> = Promise.resolve();

const writeQueue = (queue: QueuedVisit[]) => {
  writeSequence = writeSequence
    .catch(() => undefined)
    .then(() => writeIndexedQueue(queue));
  return writeSequence;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `VISIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `VISIT-${Date.now().toString(36).toUpperCase()}`;
};

export const listQueuedVisits = async () => {
  await migrateLegacyQueue();
  await writeSequence.catch(() => undefined);
  return readIndexedQueue();
};

export const getQueuedVisitCount = async () => (await listQueuedVisits()).length;

export const upsertQueuedVisit = async (payload: any, visitId?: string, status: QueueStatus = 'pending') => {
  const queue = await listQueuedVisits();
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

  await writeQueue(queue);
  return base;
};

export const updateQueuedVisit = async (visitId: string, patch: Partial<QueuedVisit>) => {
  const queue = await listQueuedVisits();
  const index = queue.findIndex((item) => item.visitId === visitId);
  if (index === -1) return null;

  queue[index] = {
    ...queue[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await writeQueue(queue);
  return queue[index];
};

export const removeQueuedVisit = async (visitId: string) => {
  const queue = (await listQueuedVisits()).filter((item) => item.visitId !== visitId);
  await writeQueue(queue);
};

export const clearQueuedVisits = async () => {
  await writeQueue([]);
};
