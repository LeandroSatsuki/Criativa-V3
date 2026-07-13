import type { VisitState } from '../types';

const DB_NAME = 'criativa-field-ops';
const DB_VERSION = 1;
const STORE_NAME = 'visit-drafts';
const ACTIVE_DRAFT_KEY = 'active-visit';

type PersistedVisitState = VisitState & {
  draftOwnerId?: string | null;
};

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB indisponivel neste navegador.'));
    return;
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onerror = () => reject(request.error || new Error('Falha ao abrir o armazenamento local.'));
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
});

const readIndexedDraft = async () => {
  const database = await openDatabase();

  return new Promise<PersistedVisitState | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_DRAFT_KEY);
    request.onerror = () => reject(request.error || new Error('Falha ao ler o rascunho local.'));
    request.onsuccess = () => resolve((request.result as PersistedVisitState | undefined) || null);
    transaction.oncomplete = () => database.close();
  });
};

const writeIndexedDraft = async (state: PersistedVisitState) => {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(state, ACTIVE_DRAFT_KEY);
    transaction.onerror = () => reject(transaction.error || new Error('Falha ao salvar o rascunho local.'));
    transaction.onabort = () => reject(transaction.error || new Error('O salvamento local foi interrompido.'));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
};

const stripPhotosForCompatibility = (state: PersistedVisitState): PersistedVisitState => ({
  ...state,
  photos: Object.fromEntries(Object.keys(state.photos || {}).map((section) => [section, []])),
  industryExecutions: Object.fromEntries(
    Object.entries(state.industryExecutions || {}).map(([industry, execution]) => [
      industry,
      {
        ...execution,
        photos: Object.fromEntries(Object.keys(execution.photos || {}).map((section) => [section, []])),
      },
    ]),
  ),
});

export const readLegacyVisitState = (storageKey: string): PersistedVisitState | null => {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) as PersistedVisitState : null;
  } catch {
    return null;
  }
};

export const loadVisitDraft = async (storageKey: string) => {
  try {
    const indexedDraft = await readIndexedDraft();
    if (indexedDraft) return indexedDraft;
  } catch (error) {
    console.warn('IndexedDB indisponivel ao restaurar visita; usando copia de compatibilidade.', error);
  }

  return readLegacyVisitState(storageKey);
};

let saveSequence: Promise<void> = Promise.resolve();

export const saveVisitDraft = (storageKey: string, state: PersistedVisitState) => {
  saveSequence = saveSequence
    .catch(() => undefined)
    .then(async () => {
      await writeIndexedDraft(state);
      localStorage.setItem(storageKey, JSON.stringify(stripPhotosForCompatibility(state)));
    });

  return saveSequence;
};

export const requestPersistentVisitStorage = async () => {
  if (!navigator.storage?.persist) return false;

  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
};
