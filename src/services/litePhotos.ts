import { withLocalVisitLock, hasLocalVisitLocks } from './localVisitLock.ts';
import { evidenceTransaction } from './durableStorage.ts';
const PREFIX = 'criativa-photo-v1:';
const DB = 'criativa-lite-photos';
const STORE = 'photos';
const CONFIRMED = 'confirmed-visits';
export const PHOTO_RETENTION_MS = 24 * 60 * 60 * 1000;

export const isLocalPhoto = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(PREFIX);

export class LocalPhotoUnavailableError extends Error {
  readonly reason: 'missing' | 'owner';
  readonly photoId: string;
  constructor(reason: 'missing' | 'owner', photoId: string) {
    super(reason === 'owner'
      ? 'A foto pertence a outro usuario. Os dados foram preservados.'
      : 'Foto local indisponivel. A visita foi preservada para recuperacao.');
    this.name = 'LocalPhotoUnavailableError';
    this.reason = reason;
    this.photoId = photoId;
  }
}

const openPhotos = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB, 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    if (!request.result.objectStoreNames.contains(CONFIRMED)) request.result.createObjectStore(CONFIRMED, { keyPath: 'key' });
  };
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});

export const storeLocalPhoto = async (ownerId: string, base64: string, context?: {
  visitId: string; storeId: string; section: string; industry: string; capturedAt: string;
}) => {
  if (!ownerId || !base64) throw new Error('Foto ou proprietario nao identificado.');
  const id = `${PREFIX}${encodeURIComponent(ownerId)}:${crypto.randomUUID()}`;
  const db = await openPhotos();
  try {
    await withLocalVisitLock(async () => {
      await new Promise<void>((resolve, reject) => {
        const tx = evidenceTransaction(db, STORE);
        tx.objectStore(STORE).add({ id, ownerId, base64, context, storedAt: new Date().toISOString(), writerBuild: typeof document === 'undefined' ? 'unknown' : document.querySelector('script[type="module"][src]')?.getAttribute('src') || 'unknown' });
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('Foto nao salva.'));
      });
      // One photo at a time: do not publish a reference before a fresh read of
      // the committed record confirms its owner and exact bytes.
      if (await readLocalPhoto(ownerId, id) !== base64) {
        throw new Error('Nao foi possivel confirmar a foto salva. Tente tirar a foto novamente.');
      }
    });
  } finally { db.close(); }
  if (ownerId === '101' && context?.visitId && typeof window !== 'undefined') {
    window.dispatchEvent?.(new CustomEvent('criativa-photo-saved', { detail: { ownerId } }));
  }
  return id;
};

export const readLocalPhoto = async (ownerId: string, id: string): Promise<string> => {
  if (!isLocalPhoto(id)) return id;
  if (!ownerId || !id.startsWith(`${PREFIX}${encodeURIComponent(ownerId)}:`)) {
    throw new LocalPhotoUnavailableError('owner', id);
  }
  const db = await openPhotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    tx.oncomplete = () => {
      db.close();
      if (!request.result?.base64) {
        if (ownerId !== '101') { reject(new LocalPhotoUnavailableError('missing', id)); return; }
        // Never omit an unavailable image. Use only the authenticated owner's
        // verified server copy when this controlled recovery pilot is enabled.
        void import('./photoRecoveryClient.ts').then(module => module.recoverPhotoCopy(ownerId, id))
          .then(async copy => {
            if (!copy) { reject(new LocalPhotoUnavailableError('missing', id)); return; }
            // Restore the same reference when storage is writable. A full disk
            // must not prevent online delivery of an already verified copy.
            let recovered: IDBDatabase | undefined;
            try {
              recovered = await openPhotos();
              await new Promise<void>((saved, failed) => {
                const tx = evidenceTransaction(recovered, STORE), store = tx.objectStore(STORE), existing = store.get(id);
                existing.onsuccess = () => {
                  if (!existing.result) store.add({ id, ownerId, base64: copy.base64, context: { visitId: copy.visitId }, recoveredAt: new Date().toISOString() });
                };
                tx.oncomplete = () => saved();
                tx.onabort = tx.onerror = () => failed(tx.error);
              });
            } catch { /* Server copy remains available; never delete/overwrite. */ }
            finally { recovered?.close(); }
            resolve(copy.base64);
          })
          .catch(reject);
      }
      else if (request.result.ownerId !== ownerId) reject(new LocalPhotoUnavailableError('owner', id));
      else resolve(request.result.base64);
    };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

export const hasLocalPhotos = (value: unknown): boolean => {
  if (isLocalPhoto(value)) return true;
  return Boolean(value && typeof value === 'object' && Object.values(value).some(hasLocalPhotos));
};

export const localPhotoIds = (value: unknown, ids = new Set<string>()): Set<string> => {
  if (isLocalPhoto(value)) ids.add(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(item => localPhotoIds(item, ids));
  return ids;
};

export const markPhotosConfirmed = async (ownerId: string, visitId: string, payload: unknown) => {
  const ids = [...localPhotoIds(payload)].filter(id => id.startsWith(`${PREFIX}${encodeURIComponent(ownerId)}:`));
  if (!ids.length) return;
  await withLocalVisitLock(async () => {
    const db = await openPhotos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONFIRMED, 'readwrite');
      tx.objectStore(CONFIRMED).put({ key: `${ownerId}:${visitId}`, ownerId, visitId, ids, confirmedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
};

const readGuard = async (name: string, store: string, key?: string, countOnly = false): Promise<any> => {
  const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
    let missing = false;
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => { missing = true; request.transaction!.abort(); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => missing ? resolve(null) : reject(request.error);
  });
  if (!db) return null;
  if (!db.objectStoreNames.contains(store)) { db.close(); return null; }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store);
    const request = key ? (countOnly ? tx.objectStore(store).count(key) : tx.objectStore(store).get(key)) : tx.objectStore(store).count();
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

// Retain uncertain/orphan photos. Delete only acknowledged visits after a full day,
// with no queue and no draft photo evidence, while all local writes are locked.
export const pruneConfirmedPhotos = async (ownerId: string, now = Date.now()) => {
  if (!hasLocalVisitLocks()) return 0;
  return withLocalVisitLock(async () => {
    const queued = await readGuard('criativa-field-ops-sync', 'queued-visits');
    if (queued) return 0;
    if (await readGuard('criativa-field-ops', 'visit-drafts', `owner-draft:${encodeURIComponent(ownerId)}`, true)) return 0;
    const draft = await readGuard('criativa-field-ops', 'visit-drafts', 'active-visit');
    if (draft && (draft.checkInDone || draft.tasks?.CHECKIN || localPhotoIds(draft).size
      || Object.values(draft.photos || {}).some((photos: any) => photos?.length))) return 0;
    const db = await openPhotos();
    return new Promise<number>((resolve, reject) => {
      let deleted = 0;
      const tx = db.transaction([CONFIRMED, STORE], 'readwrite');
      const cursor = tx.objectStore(CONFIRMED).openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        const receipt = item.value;
        if (receipt.ownerId === ownerId && Number.isFinite(receipt.confirmedAt)
          && now - receipt.confirmedAt >= PHOTO_RETENTION_MS) {
          for (const id of receipt.ids) {
            const request = tx.objectStore(STORE).get(id);
            request.onsuccess = () => {
              const photo = request.result;
              if (photo?.ownerId === ownerId && photo.context?.visitId === receipt.visitId) {
                tx.objectStore(STORE).delete(id); deleted++;
              }
            };
          }
          item.delete();
        }
        item.continue();
      };
      tx.oncomplete = () => { db.close(); resolve(deleted); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
};
