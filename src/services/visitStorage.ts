import type { VisitState } from '../types';

const DB_NAME = 'criativa-field-ops';
const DB_VERSION = 1;
const STORE_NAME = 'visit-drafts';
const ACTIVE_DRAFT_KEY = 'active-visit';
const POSITION_KEY = 'active-visit-position';

type PersistedVisitState = VisitState & {
  draftOwnerId?: string | null;
};

const draftOwner = (state: PersistedVisitState) => state.draftOwnerId || state.user?.id || null;
const draftPosition = (state: PersistedVisitState) => ({
  ownerId: draftOwner(state), visitId: state.visitId || null, step: state.step,
});

// Catalogs are refreshed separately; navigation does not change photo evidence.
const transientKeys = new Set(['step', 'availableStores', 'industries']);
const sameUser = (left: PersistedVisitState['user'], right: PersistedVisitState['user']) => {
  if (left === right) return true;
  if (!left || !right) return false;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => left[key as keyof typeof left] === right[key as keyof typeof right]);
};
const sameVisitContent = (left: PersistedVisitState, right: PersistedVisitState) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => transientKeys.has(key) || (key === 'user'
    ? sameUser(left.user, right.user)
    : (left as any)[key] === (right as any)[key]));
};
let committedDraft: { storageKey: string; state: PersistedVisitState } | null = null;

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
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(ACTIVE_DRAFT_KEY);
    const position = store.get(POSITION_KEY);
    request.onerror = () => reject(request.error || new Error('Falha ao ler o rascunho local.'));
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
    transaction.oncomplete = () => {
      database.close();
      const state = request.result as PersistedVisitState | undefined;
      const savedPosition = position.result;
      if (state && savedPosition && savedPosition.ownerId === draftOwner(state)
        && savedPosition.visitId === (state.visitId || null) && typeof savedPosition.step === 'string') {
        resolve({ ...state, step: savedPosition.step });
      } else resolve(state || null);
    };
  });
};

const writeIndexedDraft = async (state: PersistedVisitState, positionOnly: boolean) => {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    if (!positionOnly) store.put(state, ACTIVE_DRAFT_KEY);
    store.put(draftPosition(state), POSITION_KEY);
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Falha ao salvar o rascunho local.')); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error('O salvamento local foi interrompido.')); };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
};

const stripPhotosForCompatibility = (state: PersistedVisitState): PersistedVisitState => ({
  ...state,
  photos: Object.fromEntries(Object.keys(state.photos || {}).map((section) => [section, []])),
  returnsPhotosByIndustry: Object.fromEntries(
    Object.keys(state.returnsPhotosByIndustry || {}).map((industry) => [industry, []]),
  ),
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
    if (indexedDraft) {
      if (!saveSequence && !pendingSave) committedDraft = { storageKey, state: indexedDraft };
      return indexedDraft;
    }
  } catch (error) {
    console.warn('IndexedDB indisponivel ao restaurar visita; usando copia de compatibilidade.', error);
  }

  return readLegacyVisitState(storageKey);
};

let pendingSave: { storageKey: string; state: PersistedVisitState } | null = null;
let saveSequence: Promise<void> | null = null;

const flushPendingSaves = async () => {
  while (pendingSave) {
    const current = pendingSave;
    pendingSave = null;
    const sameContent = committedDraft?.storageKey === current.storageKey
      && sameVisitContent(committedDraft.state, current.state);
    if (sameContent && committedDraft!.state.step === current.state.step) continue;
    await writeIndexedDraft(current.state, sameContent);
    localStorage.setItem(
      current.storageKey,
      JSON.stringify(stripPhotosForCompatibility(current.state)),
    );
    committedDraft = current;
  }
};

export const saveVisitDraft = (storageKey: string, state: PersistedVisitState) => {
  pendingSave = { storageKey, state };
  if (!saveSequence) {
    saveSequence = flushPendingSaves().finally(() => {
      saveSequence = null;
    });
  }

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
