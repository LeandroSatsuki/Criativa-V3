export const PHOTO_TARGET_BYTES = 100 * 1024;
export const PHOTO_MAX_BYTES = 120 * 1024;
export const PHOTO_INITIAL_MAX_LONG_EDGE = 832;

const MAX_QUALITY = 0.62;
const MIN_QUALITY = 0.38;
const EMERGENCY_QUALITIES = [0.28, 0.18];
const QUALITY_SEARCH_STEPS = 5;
const FALLBACK_LONG_EDGES = [749, 666, 624, 582, 520];

export type CompressedPhoto = {
  base64: string;
  bytes: number;
  width: number;
  height: number;
  quality: number;
};

type EncodedPhoto = {
  blob: Blob;
  quality: number;
};

export const buildPhotoLongEdgeCandidates = (sourceLongEdge: number) => {
  const normalized = Math.max(1, Math.round(sourceLongEdge));
  return [
    normalized,
    ...FALLBACK_LONG_EDGES.filter((edge) => edge < normalized),
  ];
};

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível compactar a foto.'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Não foi possível finalizar a foto.'));
  reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.readAsDataURL(blob);
});

const resizeCanvas = (source: HTMLCanvasElement, targetLongEdge: number) => {
  const sourceLongEdge = Math.max(source.width, source.height);
  if (targetLongEdge >= sourceLongEdge) return source;

  const scale = targetLongEdge / sourceLongEdge;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível redimensionar a foto.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const encodeAtBestQuality = async (canvas: HTMLCanvasElement): Promise<EncodedPhoto> => {
  const high = await canvasToJpeg(canvas, MAX_QUALITY);
  if (high.size <= PHOTO_TARGET_BYTES) return { blob: high, quality: MAX_QUALITY };

  const low = await canvasToJpeg(canvas, MIN_QUALITY);
  if (low.size > PHOTO_TARGET_BYTES) return { blob: low, quality: MIN_QUALITY };

  let best = { blob: low, quality: MIN_QUALITY };
  let lowerQuality = MIN_QUALITY;
  let upperQuality = MAX_QUALITY;

  for (let attempt = 0; attempt < QUALITY_SEARCH_STEPS; attempt += 1) {
    const quality = (lowerQuality + upperQuality) / 2;
    const blob = await canvasToJpeg(canvas, quality);
    if (blob.size <= PHOTO_TARGET_BYTES) {
      best = { blob, quality };
      lowerQuality = quality;
    } else {
      upperQuality = quality;
    }
  }

  return best;
};

export const compressStampedPhoto = async (
  sourceCanvas: HTMLCanvasElement,
): Promise<CompressedPhoto> => {
  const longEdges = buildPhotoLongEdgeCandidates(
    Math.max(sourceCanvas.width, sourceCanvas.height),
  );
  let lastCanvas = sourceCanvas;
  let lastEncoded: EncodedPhoto | null = null;

  for (const longEdge of longEdges) {
    const canvas = resizeCanvas(sourceCanvas, longEdge);
    const encoded = await encodeAtBestQuality(canvas);
    lastCanvas = canvas;
    lastEncoded = encoded;
    if (encoded.blob.size <= PHOTO_MAX_BYTES) {
      return {
        base64: await blobToBase64(encoded.blob),
        bytes: encoded.blob.size,
        width: canvas.width,
        height: canvas.height,
        quality: encoded.quality,
      };
    }
  }

  for (const quality of EMERGENCY_QUALITIES) {
    const blob = await canvasToJpeg(lastCanvas, quality);
    lastEncoded = { blob, quality };
    if (blob.size <= PHOTO_MAX_BYTES) break;
  }

  if (!lastEncoded || lastEncoded.blob.size > PHOTO_MAX_BYTES) {
    throw new Error('A foto ficou acima do limite seguro. Tente capturar novamente.');
  }

  return {
    base64: await blobToBase64(lastEncoded.blob),
    bytes: lastEncoded.blob.size,
    width: lastCanvas.width,
    height: lastCanvas.height,
    quality: lastEncoded.quality,
  };
};
