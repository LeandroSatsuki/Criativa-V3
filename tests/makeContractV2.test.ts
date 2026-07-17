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

  assert.equal(first.length, 8);
  assert.deepEqual(first.map((event) => event.ID_FOTO), second.map((event) => event.ID_FOTO));
  assert.equal(new Set(first.map((event) => event.ID_FOTO)).size, first.length);
  assert.equal(first.filter((event) => event.ETAPA === 'TROCAS').length, 1);
  assert.ok(first.every((event) => event.ROW_WRITE === false));
});

test('gera um único fechamento por visita, sem base64 e com dados agregados', () => {
  const events = buildMakePhotoEvents(payload);
  const manifest: DriveSyncManifest = {
    contractVersion: '2.0',
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
      syncedAt: '2026-07-17T10:01:00',
    }])),
  };

  const finalize = buildMakeVisitFinalizeEvent(payload, events, manifest);
  assert.equal(finalize.EVENT_TYPE, 'VISIT_FINALIZE');
  assert.equal(finalize.ROW_MODE, 'UPSERT_BY_ID_VISITA');
  assert.equal(finalize.ID_VISITA, payload.visitId);
  assert.equal(finalize.INDUSTRIAS_VISITA, 'IDEALPAN, VENEZA');
  assert.equal(finalize.TOTAL_FOTOS, 8);
  assert.equal(finalize.QTD_FOTOS_ANTES, 3);
  assert.equal(finalize.LINK_FOTO_ANTES, '');
  assert.ok(finalize.LINK_FOTO_CHECKIN.includes('/file-'));
  assert.equal(JSON.stringify(finalize).includes('FOTO_BASE64'), false);
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
  }), event);
  assert.equal(receipt.fileId, 'drive-file-id');

  const manifest: DriveSyncManifest = { contractVersion: '2.0', totalPhotos: 1, photos: { [event.ID_FOTO]: receipt } };
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

