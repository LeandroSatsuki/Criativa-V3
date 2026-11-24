import type { VisitState } from '../types';
import { withLocalVisitLock } from './localVisitLock.ts';
import { evidenceTransaction } from './durableStorage.ts';

const DB_NAME = 'criativa-field-ops';
const DB_VERSION = 1;
const STORE_NAME = 'visit-drafts';
const ACTIVE_DRAFT_KEY = 'active-visit';
const POSITION_KEY = 'active-visit-position';
const OWNER_KEY = 'active-visit-owner';
const ownerDraftKey = (ownerId: string) => `owner-draft:${encodeURIComponent(ownerId)}`;

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

const readIndexedDraft = async (ownerId?: string) => {
  const database = await openDatabase();

  return new Promise<{ state: PersistedVisitState | null; active: boolean }>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(ACTIVE_DRAFT_KEY);
    const position = store.get(POSITION_KEY);
    let archived: IDBRequest | null = null;
    request.onsuccess = () => {
      if (ownerId && (!request.result || draftOwner(request.result) !== ownerId)) {
        archived = store.get(ownerDraftKey(ownerId));
      }
    };
    request.onerror = () => reject(request.error || new Error('Falha ao ler o rascunho local.'));
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
    transaction.oncomplete = () => {
      database.close();
      const state = (archived ? archived.result : request.result) as PersistedVisitState | undefined;
      const savedPosition = position.result;
      if (state && savedPosition && savedPosition.ownerId === draftOwner(state)
        && savedPosition.visitId === (state.visitId || null) && typeof savedPosition.step === 'string') {
        resolve({ state: { ...state, step: savedPosition.step }, active: !archived });
      } else resolve({ state: state || null, active: !archived });
    };
  });
};

const writeIndexedDraft = async (state: PersistedVisitState, positionOnly: boolean) => {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = positionOnly ? database.transaction(STORE_NAME, 'readwrite') : evidenceTransaction(database, STORE_NAME);
    const store = transaction.objectStore(STORE_NAME);
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Falha ao salvar o rascunho local.')); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error('O salvamento local foi interrompido.')); };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    const write = (forceFull = false, initializeOwner = false) => {
      if (!positionOnly || forceFull) store.put(state, ACTIVE_DRAFT_KEY);
      store.put(draftPosition(state), POSITION_KEY);
      if (!positionOnly || forceFull || initializeOwner) {
        store.put({ ownerId: draftOwner(state) }, OWNER_KEY);
        if (draftOwner(state)) store.delete(ownerDraftKey(draftOwner(state)!));
      }
    };
    const metadata = store.get(OWNER_KEY);
    metadata.onsuccess = () => {
      if (metadata.result?.ownerId === draftOwner(state)) { write(); return; }
      // Archive a different account atomically before changing the active slot.
      const previous = store.get(ACTIVE_DRAFT_KEY);
      const position = store.get(POSITION_KEY);
      previous.onsuccess = () => {
        const old = previous.result as PersistedVisitState | undefined;
        if (old && draftOwner(old) && draftOwner(old) !== draftOwner(state)) {
          position.onsuccess = () => {
            const saved = position.result;
            const snapshot = saved?.ownerId === draftOwner(old) && saved.visitId === (old.visitId || null)
              ? { ...old, step: saved.step } : old;
            store.put(snapshot, ownerDraftKey(draftOwner(old)!));
            write(true);
          };
        } else write(!old, true);
      };
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

export const loadVisitDraft = async (storageKey: string, ownerId?: string) => {
  try {
    const indexedDraft = await readIndexedDraft(ownerId);
    if (indexedDraft.state) {
      if (!saveSequence && !pendingSave) committedDraft = indexedDraft.active
        ? { storageKey, state: indexedDraft.state } : null;
      return indexedDraft.state;
    }
  } catch (error) {
    // A compatibility copy can omit photos. Never treat a failed read as an
    // empty draft and then overwrite the real evidence when storage recovers.
    throw error;
  }

  const legacy = readLegacyVisitState(storageKey);
  return legacy && (!ownerId || draftOwner(legacy) === ownerId) ? legacy : null;
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
    await withLocalVisitLock(() => writeIndexedDraft(current.state, sameContent));
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

let persistenceRequest: Promise<boolean> | null = null;
export const requestPersistentVisitStorage = () => {
  if (!persistenceRequest) persistenceRequest = (async () => {
    if (!navigator.storage?.persist) return false;
    try { return await navigator.storage.persist(); }
    catch { return false; }
  })();
  return persistenceRequest;
};

// Keep a recovery copy under its own key. Never replace the active draft,
// another account's archive, or any photo while abandoning a specific queue.
export const archiveAbandonedQueue = async (ownerId: string, visitId: string, queued: unknown) => {
  await withLocalVisitLock(async () => {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ ownerId, visitId, queued, abandonedAt: new Date().toISOString(), reason: 'operator-authorized-2026-11-24' }, `abandoned-queue:${encodeURIComponent(ownerId)}:${visitId}`);
      tx.oncomplete = () => { database.close(); resolve(); };
      tx.onabort = tx.onerror = () => { database.close(); reject(tx.error || new Error('Nao foi possivel preservar a copia de seguranca.')); };
    });
  });
};
