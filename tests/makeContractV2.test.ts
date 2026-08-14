import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMakePhotoEvents,
  buildMakeVisitFinalizeEvent,
  validatePhotoUploadResponse,
  validateVisitFinalizeResponse,
  type DriveSyncManifest,
} from '../netlify/functions/_shared/make-contract-v2.ts';

const photo = (marker: string) => Buffer.from(`foto-${marker}-${'x'.repeat(500)}`).toString('base64');

const payload = {
  visitId: 'VISIT-ETAPA-B',
  currentStore: 'Itapoã Supermercado - Mata da Praia',
  checkInTime: '2026-07-17T09:00:00-03:00',
  checkOutTime: '2026-07-17T10:00:00-03:00',
  user: { name: 'Promotor Teste' },
  photos: {
    FACHADA: [photo('fachada')],
    CHECKOUT: [photo('checkout')],
  },
  industryExecutions: {
    VENEZA: {
      industry: 'VENEZA',
      photos: {
        ANTES: [photo('veneza-antes-1'), photo('veneza-antes-2')],
        DEPOIS: [photo('veneza-depois')],
        TROCAS: [photo('veneza-troca')],
      },
      stockQuantities: { VENEZA: '10' },
      aiResults: {},
      hasReturns: true,
    },
    IDEALPAN: {
      industry: 'IDEALPAN',
      photos: {
        ANTES: [photo('idealpan-antes')],
        DEPOIS: [photo('idealpan-depois')],
      },
      stockQuantities: { IDEALPAN: '5' },
      aiResults: {},
      hasReturns: false,
    },
  },
  returnsPhotosByIndustry: {
    VENEZA: [photo('veneza-troca')],
  },
};

test('gera um evento por foto, sem duplicar devolução e com IDs estáveis', () => {
  const first = buildMakePhotoEvents(payload);
  const second = buildMakePhotoEvents(payload);

  assert.equal(first.length, 10);
  assert.deepEqual(first.map((event) => event.ID_FOTO), second.map((event) => event.ID_FOTO));
  assert.equal(new Set(first.map((event) => event.ID_FOTO)).size, first.length);
  assert.equal(first.filter((event) => event.ETAPA === 'TROCAS').length, 1);
  assert.ok(first.every((event) => event.ROW_WRITE === false));
  assert.ok(first.every((event) => event.PASTA_VISITA_NOME === '17-07-2026'));
  assert.ok(first.every((event) => event.PASTA_PDV_NOME === 'Itapoã Supermercado - Mata da Praia'));
  assert.ok(first.every((event) => event.LAYOUT_PASTAS === 'INDUSTRIA_DATA_PDV_V1'));
  assert.equal(first.filter((event) => event.PASTA_SUBPASTA_NOME === 'DEVOLUCOES').length, 1);
  assert.ok(first.filter((event) => event.ETAPA !== 'TROCAS').every(
    (event) => event.PASTA_SUBPASTA_NOME === '',
  ));
  assert.deepEqual(
    new Set(first.map((event) => event.PASTA_INDUSTRIA_NOME)),
    new Set(['VENEZA', 'IDEALPAN']),
  );
  assert.equal(first.filter((event) => event.ETAPA === 'FACHADA').length, 2);
  assert.equal(first.filter((event) => event.ETAPA === 'CHECKOUT').length, 2);
});

test('normaliza separadores perigosos no nome da pasta do PDV', () => {
  const event = buildMakePhotoEvents({
    ...payload,
    currentStore: 'Loja / Filial \\ Centro',
  })[0];

  assert.equal(event.PASTA_PDV_NOME, 'Loja - Filial - Centro');
});

test('preserva 90 fotos, inclusive capturas com conteúdo idêntico', () => {
  const repeatedPhoto = photo('repetida');
  const manyPhotosPayload = structuredClone(payload);
  manyPhotosPayload.industryExecutions.VENEZA.photos = {
    ANTES: Array.from({ length: 30 }, () => repeatedPhoto),
    DEPOIS: Array.from({ length: 30 }, (_, index) => photo(`depois-${index}`)),
    TROCAS: Array.from({ length: 30 }, (_, index) => photo(`troca-${index}`)),
  };
  manyPhotosPayload.industryExecutions.IDEALPAN.photos = {} as typeof payload.industryExecutions.IDEALPAN.photos;
  manyPhotosPayload.returnsPhotosByIndustry = {} as typeof payload.returnsPhotosByIndustry;

  const events = buildMakePhotoEvents(manyPhotosPayload);

  assert.equal(events.length, 92);
  assert.equal(events.filter((event) => event.INDUSTRIA === 'VENEZA').length, 92);
  assert.equal(events.filter((event) => event.ETAPA === 'ANTES').length, 30);
  assert.equal(new Set(events.map((event) => event.ID_FOTO)).size, 92);
  assert.deepEqual(
    events.filter((event) => event.ETAPA === 'ANTES').map((event) => event.ORDEM),
    Array.from({ length: 30 }, (_, index) => index + 1),
  );
});

test('gera um único fechamento por visita, sem base64 e com dados agregados', () => {
  const events = buildMakePhotoEvents(payload);
  const manifest: DriveSyncManifest = {
    contractVersion: '2.1',
    totalPhotos: events.length,
    folderUrl: 'https://drive.google.com/drive/folders/pasta',
    photos: Object.fromEntries(events.map((event) => [event.ID_FOTO, {
      eventId: event.EVENT_ID,
      photoId: event.ID_FOTO,
      stage: event.ETAPA,
      industry: event.INDUSTRIA,
      order: event.ORDEM,
      fileName: event.NOME_ARQUIVO,
      fileId: `file-${event.ID_FOTO}`,
      fileUrl: `https://drive.google.com/file/d/file-${event.ID_FOTO}/view`,
      folderUrl: 'https://drive.google.com/drive/folders/pasta',
      pdvFolderUrl: 'https://drive.google.com/drive/folders/pdv',
      syncedAt: '2026-07-17T10:01:00',
    }])),
  };

  const finalize = buildMakeVisitFinalizeEvent(payload, events, manifest);
  assert.equal(finalize.EVENT_TYPE, 'VISIT_FINALIZE');
  assert.equal(finalize.ROW_MODE, 'UPSERT_BY_ID_VISITA');
  assert.equal(finalize.ID_VISITA, payload.visitId);
  assert.equal(finalize.INDUSTRIAS_VISITA, 'IDEALPAN, VENEZA');
  assert.equal(finalize.TOTAL_FOTOS, 10);
  assert.equal(finalize.QTD_FOTOS_ANTES, 3);
  assert.equal(finalize.LINK_FOTO_ANTES, '');
  assert.ok(finalize.LINK_FOTO_CHECKIN.includes('/file-'));
  assert.equal(JSON.stringify(finalize).includes('FOTO_BASE64'), false);
  assert.match(finalize.PASTA_FOTOS_DRIVE_URL, /IDEALPAN|VENEZA/);
  assert.match(finalize.PASTA_FOTOS_DRIVE_URL, /\/pdv/);
});

test('preserva o horario de Brasilia em filas antigas sem fuso', () => {
  const legacyPayload = {
    ...payload,
    checkInTime: '2026-08-13T10:37:00',
    checkOutTime: '2026-08-13T10:38:00',
  };
  const events = buildMakePhotoEvents(legacyPayload);
  const manifest: DriveSyncManifest = {
    contractVersion: '2.1',
    totalPhotos: events.length,
    photos: {},
  };

  const finalize = buildMakeVisitFinalizeEvent(legacyPayload, events, manifest);

  assert.equal(finalize['HORA_ENTRADA_CHECK-IN'], '10:37');
  assert.equal(finalize['HORA_SAIDA_CHECK-OUT'], '10:38');
  assert.equal(finalize.TEMPO_PERMANENCIA, '0h 1m');
});

test('não aceita HTTP 200 genérico como confirmação de upload', () => {
  const event = buildMakePhotoEvents(payload)[0];
  assert.throws(() => validatePhotoUploadResponse('Accepted', event));
  assert.throws(() => validatePhotoUploadResponse(JSON.stringify({ success: true }), event));
});

test('valida confirmações vinculadas ao evento e à visita', () => {
  const event = buildMakePhotoEvents(payload)[0];
  const receipt = validatePhotoUploadResponse(JSON.stringify({
    success: true,
    eventType: 'PHOTO_UPLOADED',
    eventId: event.EVENT_ID,
    photoId: event.ID_FOTO,
    fileId: 'drive-file-id',
    fileUrl: 'https://drive.google.com/file/d/drive-file-id/view',
    folderId: 'drive-folder-id',
    folderUrl: 'https://drive.google.com/drive/folders/drive-folder-id',
    pdvFolderId: 'drive-pdv-folder-id',
    pdvFolderUrl: 'https://drive.google.com/drive/folders/drive-pdv-folder-id',
  }), event);
  assert.equal(receipt.fileId, 'drive-file-id');
  assert.equal(receipt.pdvFolderId, 'drive-pdv-folder-id');

  const manifest: DriveSyncManifest = { contractVersion: '2.1', totalPhotos: 1, photos: { [event.ID_FOTO]: receipt } };
  const finalize = buildMakeVisitFinalizeEvent(payload, [event], manifest);
  const confirmation = validateVisitFinalizeResponse(JSON.stringify({
    success: true,
    eventType: 'VISIT_FINALIZED',
    eventId: finalize.EVENT_ID,
    visitId: finalize.ID_VISITA,
    rowAction: 'updated',
    rowId: '42',
  }), finalize);
  assert.equal(confirmation.rowAction, 'updated');
});
