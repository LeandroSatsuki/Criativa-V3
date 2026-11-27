import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAutomaticCheckout, getCheckoutDeadline } from '../src/services/automaticCheckout.ts';
import { submitAutomaticVisit } from '../src/services/submitAutomaticVisit.ts';
import type { VisitState } from '../src/types.ts';
import { buildMakePhotoEvents, buildMakeVisitFinalizeEvent } from '../netlify/functions/_shared/make-contract-v2.ts';

const draft = {
  visitId: 'VISIT-AUTO', user: { id: 'p1', role: 'FIELD_OPS' }, currentStoreId: 'pdv1',
  checkInDone: true, checkInTime: '2026-09-28T16:15:00-03:00', checkOutTime: null,
  tasks: { CHECKIN: true, ANTES: true }, photos: { FACHADA: ['entry'], ANTES: ['photo1'] },
  industryExecutions: { INDUSTRIA: { status: 'aberto', photos: { ANTES: ['photo2'] }, tasks: { ANTES: true } } },
} as unknown as VisitState;

test('encerra as 18 de Brasilia preservando dados e etapas incompletas', () => {
  assert.equal(buildAutomaticCheckout(draft, new Date('2026-09-28T20:59:59Z')), null);
  const closed = buildAutomaticCheckout(draft, new Date('2026-09-28T21:00:00Z'))!;
  assert.equal(closed.checkOutTime, '2026-09-28T21:00:00.000Z');
  assert.equal(closed.visitId, draft.visitId);
  assert.equal(closed.photos, draft.photos);
  assert.equal(closed.industryExecutions, draft.industryExecutions);
  assert.equal(closed.tasks, draft.tasks);
  assert.equal(closed.tasks.CHECKOUT, undefined);
  assert.equal(draft.checkOutTime, null);
});

test('retorno no dia seguinte conserva data e horario do encerramento previsto', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  const closed = buildAutomaticCheckout(draft, now)!;
  assert.equal(closed.checkOutTime, '2026-09-28T21:00:00.000Z');
  assert.equal(closed.automaticCheckout?.recordedAt, now.toISOString());
  assert.equal(buildAutomaticCheckout(closed, now), null);
});

test('nao encerra clique sem entrada, supervisor, rascunho sem dono ou saida manual', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  for (const patch of [
    { checkInDone: false, tasks: {}, photos: {} }, { visitId: null }, { currentStoreId: '' },
    { user: null }, { user: { role: 'SUPERVISOR' } }, { checkInTime: 'invalido' },
    { checkOutTime: '2026-09-28T17:30:00-03:00' },
  ]) assert.equal(buildAutomaticCheckout({ ...draft, ...patch } as VisitState, now), null);
});

test('entrada excepcional apos as 18 pertence ao proximo encerramento, sem duracao negativa', () => {
  assert.equal(getCheckoutDeadline('2026-09-28T19:00:00-03:00')?.toISOString(), '2026-09-29T21:00:00.000Z');
});

test('timestamp legado sem fuso e interpretado como Brasilia', () => {
  assert.equal(getCheckoutDeadline('2026-09-28T17:00:00')?.toISOString(), '2026-09-28T21:00:00.000Z');
});

test('contrato Google finaliza visita parcial sem exigir foto de checkout', () => {
  const closed = buildAutomaticCheckout(draft, new Date('2026-09-29T12:00:00Z'))!;
  const events = buildMakePhotoEvents(closed);
  assert.ok(events.length > 0);
  assert.equal(events.some((event) => event.ETAPA === 'CHECKOUT'), false);
  const row = buildMakeVisitFinalizeEvent(closed, events, { contractVersion: '2.1', totalPhotos: events.length, photos: {} });
  assert.equal(row.ID_VISITA, draft.visitId);
  assert.equal(row['HORA_SAIDA_CHECK-OUT'], '18:00');
  assert.equal(row.DATA_VISITA, '28/09/2026');
  assert.equal(row.QTD_FOTOS_CHECKOUT, 0);
  assert.equal(row.TOTAL_FOTOS, events.length);
  assert.equal(row.TEMPO_PERMANENCIA, '1h 45m');
});

test('servidor ja confirmou: nao recria nem dispara outro envio', async () => {
  const result = await submitAutomaticVisit('v1', {}, {
    status: async () => ({ syncStatus: 'enviado' }),
    create: async () => { throw Error('nao deve recriar'); },
    start: async () => { throw Error('nao deve reiniciar'); },
  });
  assert.equal(result, 'sent');
});

test('404 cria com mesmo ID; tarefa ja iniciada nao e duplicada', async () => {
  let creates = 0;
  const result = await submitAutomaticVisit('v1', { ...draft, visitId: 'old' }, {
    status: async () => { throw Object.assign(new Error('ausente'), { status: 404 }); },
    create: async (payload) => { creates++; assert.equal(payload.visitId, 'v1'); return { visitId: 'v1', syncStarted: true }; },
    start: async () => { throw Error('nao deve duplicar'); },
  });
  assert.equal(creates, 1);
  assert.equal(result, 'syncing');
});

test('falha de rede ou HTTP 502 nao e confundida com ausencia da visita', async () => {
  for (const failure of [new Error('Failed to fetch'), Object.assign(new Error('502'), { status: 502 })]) {
    let creates = 0;
    await assert.rejects(submitAutomaticVisit('v1', draft, {
      status: async () => { throw failure; },
      create: async () => { creates++; return {}; }, start: async () => {},
    }));
    assert.equal(creates, 0);
  }
});

test('visita existente pendente retoma envio sem substituir payload; em processamento aguarda', async () => {
  for (const status of ['pendente', 'enviando']) {
    let starts = 0;
    assert.equal(await submitAutomaticVisit('v1', draft, {
      status: async () => ({ syncStatus: status }), create: async () => { throw Error('nao deve substituir'); },
      start: async (id) => { assert.equal(id, 'v1'); starts++; },
    }), 'syncing');
    assert.equal(starts, status === 'pendente' ? 1 : 0);
  }
});
