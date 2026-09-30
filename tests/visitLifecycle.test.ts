import assert from 'node:assert/strict';
import test from 'node:test';
import type { SectionId } from '../src/types.ts';
import { hasStartedVisit, recoverUnstartedVisit } from '../src/services/visitLifecycle.ts';

const DASHBOARD = 'DASHBOARD' as SectionId;
const CHECK_IN = 'CHECKIN' as SectionId;
const FACADE = 'FACHADA' as SectionId;

test('clique no PDV sem foto nao inicia visita e rascunho antigo e recuperado', () => {
  const ghostDraft = {
    visitId: 'VISIT-CLIQUE-ANTIGO',
    currentStore: 'Loja selecionada por engano',
    currentStoreId: 'PDV-10',
    checkInDone: false,
    checkInTime: '2026-09-03T17:00:00-03:00',
    photos: {},
    tasks: {},
    industries: ['Industria A'],
    step: FACADE,
  };

  assert.equal(hasStartedVisit(ghostDraft), false);
  assert.deepEqual(recoverUnstartedVisit(ghostDraft), {
    ...ghostDraft,
    visitId: null,
    currentStore: '',
    currentStoreId: '',
    checkInDone: false,
    checkInTime: null,
    checkOutTime: null,
    selectedIndustry: null,
    tasks: {},
    photos: {},
    stockQuantities: {},
    aiResults: {},
    hasReturns: null,
    returnsPhotosByIndustry: {},
    industryExecutions: {},
    step: DASHBOARD,
  });
});

test('foto de entrada inicia visita e preserva o rascunho', () => {
  const startedDraft = {
    visitId: 'VISIT-COM-FOTO',
    currentStore: 'Loja correta',
    currentStoreId: 'PDV-20',
    checkInDone: false,
    checkInTime: '2026-09-04T08:00:00-03:00',
    photos: { [FACADE]: ['foto-entrada'] },
    tasks: {},
    step: FACADE,
  };

  assert.equal(hasStartedVisit(startedDraft), true);
  assert.equal(recoverUnstartedVisit(startedDraft), startedDraft);
});

test('visita confirmada continua valida para rascunhos de versoes anteriores', () => {
  assert.equal(hasStartedVisit({ checkInDone: true, photos: {}, tasks: {} }), true);
  assert.equal(hasStartedVisit({
    checkInDone: false,
    photos: {},
    tasks: { [CHECK_IN]: true },
  }), true);
});
