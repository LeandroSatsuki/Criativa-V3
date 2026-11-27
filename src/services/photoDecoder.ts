import { PHOTO_INITIAL_MAX_LONG_EDGE } from './imageCompression.ts';

export const readPhotoDimensions = (bytes: Uint8Array): { width: number; height: number } | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
    const width = view.getUint32(16), height = view.getUint32(20);
    return width && height ? { width, height } : null;
  }
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8) return null;
      const height = view.getUint16(offset + 3), width = view.getUint16(offset + 5);
      return width && height ? { width, height } : null;
    }
    offset += length;
  }
  return null;
};

const decodeCompatibleImage = (file: Blob) => new Promise<DecodedReportPhoto>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const release = () => {
    image.onload = image.onerror = null;
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
  };
  image.onerror = () => { release(); reject(new Error('Não foi possível processar a foto.')); };
  image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, release });
  image.src = url;
});

type DecodedReportPhoto = { source: CanvasImageSource; width: number; height: number; release: () => void };

export const decodeReportPhoto = async (file: Blob): Promise<DecodedReportPhoto> => {
  if (typeof createImageBitmap === 'function') {
    try {
      // Read only a bounded header, not another copy of the camera file.
      const dimensions = readPhotoDimensions(new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer()));
      if (dimensions) {
        // Set one dimension only: preserve the browser's EXIF orientation and
        // aspect ratio even if the camera encoded its pixels sideways.
        const options: ImageBitmapOptions = { imageOrientation: 'from-image', resizeQuality: 'high' };
        if (Math.max(dimensions.width, dimensions.height) > PHOTO_INITIAL_MAX_LONG_EDGE) {
          if (dimensions.width >= dimensions.height) options.resizeWidth = PHOTO_INITIAL_MAX_LONG_EDGE;
          else options.resizeHeight = PHOTO_INITIAL_MAX_LONG_EDGE;
        }
        const bitmap = await createImageBitmap(file, options);
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      }
    } catch {
      // Older browsers and unsupported formats keep the proven compatibility path.
    }
  }
  return decodeCompatibleImage(file);
};
