import { getSession } from './session';
import { apiService } from './apiService';
import { HttpRequestError } from './httpClient';
import { getQueuedVisit } from './syncQueue';
import { LocalPhotoUnavailableError, readLocalPhoto, localPhotoIds } from './litePhotos';
import { protectPhotoCopy, photoRecoveryEnabled } from './photoRecoveryClient';
import { decodeReportPhoto } from './photoDecoder';
import { buildPortraitPhotoLayout, drawPhotoInPortrait, compressStampedPhoto, PHOTO_MAX_BYTES } from './imageCompression';

export const restorePhotoFromGallery = async (ownerId: string, visitId: string, photoId: string, file: File) => {
  if (!photoRecoveryEnabled(ownerId) || getSession()?.user.id !== ownerId) throw new Error('Conta de recuperacao invalida.');
  const queued = await getQueuedVisit(ownerId, visitId);
  if (!queued || !localPhotoIds(queued.payload).has(photoId)) throw new Error('A foto nao pertence a este envio.');
  try { await apiService.getSyncStatus(visitId); throw new Error('A visita ja foi recebida pelo servidor. Atualize o status antes de recuperar fotos.'); }
  catch (error) { if (!(error instanceof HttpRequestError && error.status === 404)) throw error; }
  try { await readLocalPhoto(ownerId, photoId); throw new Error('Esta foto ja esta acessivel. Nenhuma imagem foi substituida.'); }
  catch (error) { if (!(error instanceof LocalPhotoUnavailableError && error.reason === 'missing')) throw error; }
  if (!file.size || file.size > 32 * 1024 * 1024 || !file.type.startsWith('image/')) throw new Error('Selecione uma imagem original de ate 32 MB.');
  let base64: string;
  if (file.type === 'image/jpeg' && file.size <= PHOTO_MAX_BYTES) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('Arquivo JPEG invalido.');
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    base64 = btoa(binary);
  } else {
    const decoded = await decodeReportPhoto(file), canvas = document.createElement('canvas');
    try {
      const layout = buildPortraitPhotoLayout(decoded.width, decoded.height); canvas.width = layout.canvasWidth; canvas.height = layout.canvasHeight;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Nao foi possivel preparar a imagem.');
      drawPhotoInPortrait(context, decoded.source, layout); decoded.release();
      base64 = (await compressStampedPhoto(canvas)).base64;
    } finally { decoded.release(); canvas.width = canvas.height = 1; }
  }
  const current = await getQueuedVisit(ownerId, visitId);
  if (!current || !localPhotoIds(current.payload).has(photoId)) throw new Error('O envio mudou. As copias anteriores foram preservadas.');
  // Keep existing IDs, aliases, visit timestamps and all other photos unchanged.
  // The operator explicitly supplies the original; never invent capture dates.
  await protectPhotoCopy(ownerId, photoId, visitId, base64, 'gallery');
  if (await readLocalPhoto(ownerId, photoId) !== base64) throw new Error('A leitura da foto recuperada nao corresponde. Copias preservadas para suporte.');
};
