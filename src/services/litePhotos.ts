const PREFIX = 'criativa-photo-v1:';
const DB = 'criativa-lite-photos';
const STORE = 'photos';

export const isLocalPhoto = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(PREFIX);

const openPhotos = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});

export const storeLocalPhoto = async (ownerId: string, base64: string, context?: {
  visitId: string; storeId: string; section: string; industry: string; capturedAt: string;
}) => {
  if (!ownerId || !base64) throw new Error('Foto ou proprietario nao identificado.');
  const id = `${PREFIX}${encodeURIComponent(ownerId)}:${crypto.randomUUID()}`;
  const db = await openPhotos();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ id, ownerId, base64, context });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('Foto nao salva.')); };
  });
  return id;
};

export const readLocalPhoto = async (ownerId: string, id: string): Promise<string> => {
  if (!isLocalPhoto(id)) return id;
  if (!ownerId || !id.startsWith(`${PREFIX}${encodeURIComponent(ownerId)}:`)) {
    throw new Error('A foto pertence a outro usuario. Os dados foram preservados.');
  }
  const db = await openPhotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    tx.oncomplete = () => {
      db.close();
      if (request.result?.ownerId !== ownerId || !request.result?.base64) {
        reject(new Error('Foto local indisponivel. A visita foi preservada para recuperacao.'));
      } else resolve(request.result.base64);
    };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

export const hasLocalPhotos = (value: unknown): boolean => {
  if (isLocalPhoto(value)) return true;
  return Boolean(value && typeof value === 'object' && Object.values(value).some(hasLocalPhotos));
};
