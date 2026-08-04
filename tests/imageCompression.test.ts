import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPortraitPhotoLayout,
  buildPhotoLongEdgeCandidates,
  drawPhotoInPortrait,
  PHOTO_INITIAL_MAX_LONG_EDGE,
  PHOTO_MAX_BYTES,
  PHOTO_TARGET_BYTES,
} from '../src/services/imageCompression.ts';

test('normaliza foto horizontal para canvas em retrato', () => {
  assert.deepEqual(buildPortraitPhotoLayout(4032, 3024), {
    canvasWidth: 624,
    canvasHeight: 832,
    drawWidth: 832,
    drawHeight: 624,
    rotateClockwise: true,
  });
});

test('preserva foto que ja esta em retrato', () => {
  assert.deepEqual(buildPortraitPhotoLayout(3024, 4032), {
    canvasWidth: 624,
    canvasHeight: 832,
    drawWidth: 624,
    drawHeight: 832,
    rotateClockwise: false,
  });
});

test('gira o conteudo horizontal em 90 graus sem deslocar o desenho', () => {
  const calls: Array<[string, ...number[]]> = [];
  const context = {
    save: () => calls.push(['save']),
    translate: (x: number, y: number) => calls.push(['translate', x, y]),
    rotate: (angle: number) => calls.push(['rotate', angle]),
    drawImage: (_source: unknown, x: number, y: number, width: number, height: number) =>
      calls.push(['drawImage', x, y, width, height]),
    restore: () => calls.push(['restore']),
  } as unknown as CanvasRenderingContext2D;
  const layout = buildPortraitPhotoLayout(4032, 3024);

  drawPhotoInPortrait(context, {} as CanvasImageSource, layout);

  assert.deepEqual(calls, [
    ['save'],
    ['translate', 624, 0],
    ['rotate', Math.PI / 2],
    ['drawImage', 0, 0, 832, 624],
    ['restore'],
  ]);
});

test('define alvo menor que o teto e reduz a resolução inicial em 35 por cento', () => {
  assert.equal(PHOTO_TARGET_BYTES, 100 * 1024);
  assert.equal(PHOTO_MAX_BYTES, 120 * 1024);
  assert.equal(PHOTO_INITIAL_MAX_LONG_EDGE, 832);
  assert.ok(PHOTO_TARGET_BYTES < PHOTO_MAX_BYTES);
});

test('reduz resolução de forma progressiva somente quando necessário', () => {
  assert.deepEqual(
    buildPhotoLongEdgeCandidates(832),
    [832, 749, 666, 624, 582, 520],
  );
  assert.deepEqual(buildPhotoLongEdgeCandidates(700), [700, 666, 624, 582, 520]);
  assert.deepEqual(buildPhotoLongEdgeCandidates(500), [500]);
});
