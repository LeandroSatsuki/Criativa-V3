import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterQueuedVisitsByOwner,
  getQueuedVisitOwnerId,
  toQueuedVisitSummary,
  type QueuedVisit,
} from '../src/services/syncQueue.ts';
import {
  canAccessVisit,
} from '../netlify/functions/_shared/visit-access.ts';

const queuedVisit = (
  visitId: string,
  payloadOwnerId: string,
  ownerId?: string,
): QueuedVisit => ({
  visitId,
  ownerId,
  payload: { user: { id: payloadOwnerId } },
  status: 'pending',
  error: null,
  attempts: 0,
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T10:00:00.000Z',
});

test('fila local retorna somente visitas do usuario atual', () => {
  const queue = [
    queuedVisit('VISIT-A', 'promotor-a'),
    queuedVisit('VISIT-B', 'promotor-b'),
    queuedVisit('VISIT-C', 'promotor-a', 'promotor-a'),
  ];

  assert.deepEqual(
    filterQueuedVisitsByOwner(queue, 'promotor-a').map((visit) => visit.visitId),
    ['VISIT-A', 'VISIT-C'],
  );
  assert.deepEqual(
    filterQueuedVisitsByOwner(queue, 'promotor-b').map((visit) => visit.visitId),
    ['VISIT-B'],
  );
});

test('fila antiga sem ownerId herda o dono apenas do payload da propria visita', () => {
  const legacy = queuedVisit('VISIT-LEGACY', 'promotor-antigo');
  assert.equal(getQueuedVisitOwnerId(legacy), 'promotor-antigo');
  assert.equal(filterQueuedVisitsByOwner([legacy], 'promotor-novo').length, 0);
});

test('indice local preserva dados operacionais sem carregar fotos', () => {
  const visit = queuedVisit('VISIT-LIGHT', 'promotor-a', 'promotor-a');
  visit.payload.currentStore = 'Loja Central';
  visit.payload.photos = { checkout: ['base64-muito-grande'] };

  const summary = toQueuedVisitSummary(visit);

  assert.equal(summary.store, 'Loja Central');
  assert.equal(summary.ownerId, 'promotor-a');
  assert.equal('payload' in summary, false);
  assert.doesNotMatch(JSON.stringify(summary), /base64-muito-grande/);
});

test('visita do backend pertence ao promotor e supervisor pode auditar', () => {
  const visit = {
    visitId: 'VISIT-OWNER',
    createdAt: '2026-07-27T10:00:00.000Z',
    updatedAt: '2026-07-27T10:00:00.000Z',
    syncStatus: 'erro',
    payload: { user: { id: 'promotor-a' } },
  };

  assert.equal(canAccessVisit(visit, { sub: 'promotor-a', role: 'FIELD_OPS' }), true);
  assert.equal(canAccessVisit(visit, { sub: 'promotor-b', role: 'FIELD_OPS' }), false);
  assert.equal(canAccessVisit(visit, { sub: 'supervisor', role: 'SUPERVISOR' }), true);
});
