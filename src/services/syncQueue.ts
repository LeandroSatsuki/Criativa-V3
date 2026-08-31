export type QueueStatus = 'pending' | 'syncing' | 'error' | 'synced';

export type QueuedVisit = {
  visitId: string;
  ownerId?: string;
  payload: any;
  status: QueueStatus;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type QueuedVisitSummary = {
  visitId: string;
  ownerId: string;
  store: string;
  status: QueueStatus;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

const LEGACY_QUEUE_KEY = 'criativa_sync_queue';
const DB_NAME = 'criativa-field-ops-sync';
const DB_VERSION = 2;
const STORE_NAME = 'queued-visits';
const SUMMARY_STORE_NAME = 'queued-visit-summaries';
const OWNER_INDEX_NAME = 'ownerId';

const normalizeOwnerId = (value: unknown) => String(value || '').trim();

export const getQueuedVisitOwnerId = (visit: QueuedVisit) => normalizeOwnerId(
  visit.ownerId || visit.payload?.user?.id || visit.payload?.draftOwnerId,
);

export const toQueuedVisitSummary = (visit: QueuedVisit): QueuedVisitSummary => ({
  visitId: visit.visitId,
  ownerId: getQueuedVisitOwnerId(visit),
  store: String(visit.payload?.currentStore || 'Loja nao informada'),
  status: visit.status,
  error: visit.error,
  attempts: visit.attempts,
  createdAt: visit.createdAt,
  updatedAt: visit.updatedAt,
});

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB indisponivel neste navegador.'));
    return;
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onerror = () => reject(request.error || new Error('Falha ao abrir a fila local.'));
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'visitId' });
    }
    if (!database.objectStoreNames.contains(SUMMARY_STORE_NAME)) {
      const summaryStore = database.createObjectStore(SUMMARY_STORE_NAME, { keyPath: 'visitId' });
      summaryStore.createIndex(OWNER_INDEX_NAME, 'ownerId', { unique: false });

      const sourceStore = request.transaction?.objectStore(STORE_NAME);
      const cursorRequest = sourceStore?.openCursor();
      if (cursorRequest) {
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          summaryStore.put(toQueuedVisitSummary(cursor.value as QueuedVisit));
          cursor.continue();
        };
      }
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
    request.onsuccess = () => resolve((request.result as QueuedVisit[])
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    transaction.oncomplete = () => database.close();
  });
};

const readIndexedQueueCount = async () => {
  const database = await openDatabase();
  return new Promise<number>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).count();
    request.onerror = () => reject(request.error || new Error('Falha ao contar a fila local.'));
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
  });
};

const readIndexedVisit = async (visitId: string) => {
  const database = await openDatabase();
  return new Promise<QueuedVisit | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(visitId);
    request.onerror = () => reject(request.error || new Error('Falha ao ler a visita da fila.'));
    request.onsuccess = () => resolve((request.result as QueuedVisit | undefined) || null);
    transaction.oncomplete = () => database.close();
  });
};

const readIndexedSummaries = async (ownerId: string) => {
  const database = await openDatabase();
  return new Promise<QueuedVisitSummary[]>((resolve, reject) => {
    const transaction = database.transaction(SUMMARY_STORE_NAME, 'readonly');
    const index = transaction.objectStore(SUMMARY_STORE_NAME).index(OWNER_INDEX_NAME);
    const request = index.getAll(normalizeOwnerId(ownerId));
    request.onerror = () => reject(request.error || new Error('Falha ao ler o indice da fila local.'));
    request.onsuccess = () => resolve((request.result as QueuedVisitSummary[])
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    transaction.oncomplete = () => database.close();
  });
};

const countIndexedSummaries = async (ownerId: string) => {
  const database = await openDatabase();
  return new Promise<number>((resolve, reject) => {
    const transaction = database.transaction(SUMMARY_STORE_NAME, 'readonly');
    const index = transaction.objectStore(SUMMARY_STORE_NAME).index(OWNER_INDEX_NAME);
    const request = index.count(normalizeOwnerId(ownerId));
    request.onerror = () => reject(request.error || new Error('Falha ao contar o indice da fila local.'));
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
  });
};

const writeIndexedVisit = async (visit: QueuedVisit) => {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, SUMMARY_STORE_NAME], 'readwrite');
    transaction.objectStore(STORE_NAME).put(visit);
    transaction.objectStore(SUMMARY_STORE_NAME).put(toQueuedVisitSummary(visit));
    transaction.onerror = () => reject(transaction.error || new Error('Falha ao salvar a visita na fila.'));
    transaction.onabort = () => reject(transaction.error || new Error('O salvamento da visita foi interrompido.'));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
};

const deleteIndexedVisit = async (visitId: string) => {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, SUMMARY_STORE_NAME], 'readwrite');
    transaction.objectStore(STORE_NAME).delete(visitId);
    transaction.objectStore(SUMMARY_STORE_NAME).delete(visitId);
    transaction.onerror = () => reject(transaction.error || new Error('Falha ao remover a visita da fila.'));
    transaction.onabort = () => reject(transaction.error || new Error('A remocao da visita foi interrompida.'));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
};

const writeIndexedQueue = async (queue: QueuedVisit[]) => {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, SUMMARY_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const summaryStore = transaction.objectStore(SUMMARY_STORE_NAME);
    store.clear();
    summaryStore.clear();
    queue.forEach((visit) => {
      store.put(visit);
      summaryStore.put(toQueuedVisitSummary(visit));
    });
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
    const indexedCount = await readIndexedQueueCount();
    if (indexedCount > 0) {
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

let mutationSequence: Promise<void> = Promise.resolve();

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `VISIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `VISIT-${Date.now().toString(36).toUpperCase()}`;
};

export const filterQueuedVisitsByOwner = (queue: QueuedVisit[], ownerId: string) => {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  if (!normalizedOwnerId) return [];
  return queue.filter((visit) => getQueuedVisitOwnerId(visit) === normalizedOwnerId);
};

const listAllQueuedVisits = async () => {
  await migrateLegacyQueue();
  await mutationSequence.catch(() => undefined);
  return readIndexedQueue();
};

export const listQueuedVisits = async (ownerId: string) =>
  filterQueuedVisitsByOwner(await listAllQueuedVisits(), ownerId);

export const listQueuedVisitSummaries = async (ownerId: string) => {
  await migrateLegacyQueue();
  await mutationSequence.catch(() => undefined);
  return readIndexedSummaries(ownerId);
};

export const getQueuedVisitCount = async (ownerId: string) => {
  await migrateLegacyQueue();
  await mutationSequence.catch(() => undefined);
  return countIndexedSummaries(ownerId);
};

export const getQueuedVisit = async (ownerId: string, visitId: string) => {
  await migrateLegacyQueue();
  await mutationSequence.catch(() => undefined);
  const visit = await readIndexedVisit(visitId);
  return visit && getQueuedVisitOwnerId(visit) === normalizeOwnerId(ownerId) ? visit : null;
};

export const upsertQueuedVisit = async (
  ownerId: string,
  payload: any,
  visitId?: string,
  status: QueueStatus = 'pending',
) => {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  if (!normalizedOwnerId) throw new Error('Usuario da fila local nao identificado.');

  await migrateLegacyQueue();
  let result: QueuedVisit | null = null;
  mutationSequence = mutationSequence.catch(() => undefined).then(async () => {
    const now = new Date().toISOString();
    const resolvedVisitId = visitId || payload.visitId || generateId();
    const existing = await readIndexedVisit(resolvedVisitId);
    if (existing && getQueuedVisitOwnerId(existing) !== normalizedOwnerId) {
      throw new Error('A visita pertence a outra fila local.');
    }
    result = {
      visitId: resolvedVisitId,
      ownerId: normalizedOwnerId,
      payload: { ...payload, visitId: resolvedVisitId },
      status,
      error: null,
      attempts: existing?.attempts || 0,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await writeIndexedVisit(result);
  });
  await mutationSequence;
  return result!;
};

export const updateQueuedVisit = async (ownerId: string, visitId: string, patch: Partial<QueuedVisit>) => {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  await migrateLegacyQueue();
  let result: QueuedVisit | null = null;
  mutationSequence = mutationSequence.catch(() => undefined).then(async () => {
    const existing = await readIndexedVisit(visitId);
    if (!existing || getQueuedVisitOwnerId(existing) !== normalizedOwnerId) return;
    result = {
      ...existing,
      ...patch,
      visitId: existing.visitId,
      ownerId: normalizedOwnerId,
      updatedAt: new Date().toISOString(),
    };
    await writeIndexedVisit(result);
  });
  await mutationSequence;
  return result;
};

export const removeQueuedVisit = async (ownerId: string, visitId: string) => {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  await migrateLegacyQueue();
  mutationSequence = mutationSequence.catch(() => undefined).then(async () => {
    const existing = await readIndexedVisit(visitId);
    if (!existing || getQueuedVisitOwnerId(existing) !== normalizedOwnerId) return;
    await deleteIndexedVisit(visitId);
  });
  await mutationSequence;
};
