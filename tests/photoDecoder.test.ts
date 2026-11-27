import assert from 'node:assert/strict';
import test from 'node:test';
import { readPhotoDimensions, decodeReportPhoto } from '../src/services/photoDecoder.ts';

const jpeg = (width: number, height: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 4, 1, 2, 0xff, 0xc0, 0, 8, 8, height >> 8, height & 255, width >> 8, width & 255, 0]);

test('le dimensoes JPEG e PNG sem decodificar a foto e recusa cabecalhos truncados', () => {
  assert.deepEqual(readPhotoDimensions(jpeg(8000, 6000)), { width: 8000, height: 6000 });
  const png = new Uint8Array(24); const view = new DataView(png.buffer);
  view.setUint32(0, 0x89504e47); view.setUint32(4, 0x0d0a1a0a); view.setUint32(16, 3000); view.setUint32(20, 4000);
  assert.deepEqual(readPhotoDimensions(png), { width: 3000, height: 4000 });
  for (let i = 0; i < 18; i++) assert.equal(readPhotoDimensions(jpeg(8000, 6000).slice(0, i)), null);
  assert.equal(readPhotoDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])), null);
});

test('solicita bitmap reduzido, preserva EXIF/aspecto e libera a imagem', async () => {
  const original = globalThis.createImageBitmap;
  const options: ImageBitmapOptions[] = []; let closed = 0;
  globalThis.createImageBitmap = (async (_file: Blob, value: ImageBitmapOptions) => {
    options.push(value); return { width: 832, height: 624, close: () => { closed++; } };
  }) as typeof createImageBitmap;
  try {
    for (const [width, height] of [[8000, 6000], [3000, 4000], [300, 400]]) {
      const decoded = await decodeReportPhoto(new Blob([jpeg(width, height)])); decoded.release();
    }
    assert.equal(options[0].resizeWidth, 832); assert.equal(options[0].resizeHeight, undefined);
    assert.equal(options[1].resizeHeight, 832); assert.equal(options[1].resizeWidth, undefined);
    assert.equal(options[2].resizeHeight, undefined); assert.equal(options[2].resizeWidth, undefined);
    assert.ok(options.every(x => x.imageOrientation === 'from-image')); assert.equal(closed, 3);
  } finally { globalThis.createImageBitmap = original; }
});

test('navegador sem bitmap ou com opcao incompativel conserva captura e libera URL', async () => {
  const originals = { bitmap: globalThis.createImageBitmap, image: globalThis.Image, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let released = 0;
  class CompatibleImage {
    naturalWidth = 4000; naturalHeight = 3000;
    onload: (() => void) | null = null; onerror = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    removeAttribute() {}
  }
  globalThis.Image = CompatibleImage as unknown as typeof Image;
  URL.createObjectURL = () => 'blob:isolated-test'; URL.revokeObjectURL = () => { released++; };
  try {
    globalThis.createImageBitmap = undefined as unknown as typeof createImageBitmap;
    let decoded = await decodeReportPhoto(new Blob([jpeg(4000, 3000)]));
    assert.equal(decoded.width, 4000); decoded.release();
    globalThis.createImageBitmap = (async () => { throw new Error('unsupported'); }) as typeof createImageBitmap;
    decoded = await decodeReportPhoto(new Blob([jpeg(4000, 3000)]));
    assert.equal(decoded.height, 3000); decoded.release();
    assert.equal(released, 2);
  } finally {
    globalThis.createImageBitmap = originals.bitmap; globalThis.Image = originals.image;
    URL.createObjectURL = originals.create; URL.revokeObjectURL = originals.revoke;
  }
});
