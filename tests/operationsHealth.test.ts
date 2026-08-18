import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppData } from '../netlify/functions/_shared/data.ts';
import { buildOperationsHealth } from '../netlify/functions/_shared/operations-health.ts';
import type { VisitSummary } from '../netlify/functions/_shared/visit-summary.ts';

const now = new Date('2026-08-17T15:00:00.000Z');
const data: AppData = {
  schemaVersion: 9,
  cachedAt: '2026-08-17T14:59:00.000Z',
  industries: ['Veneza'],
  promoters: [
    { id: '1', name: 'Ativa', user: 'ativa', pass: 'segredo', region: 'Vitoria', status: 'ATIVO' },
    { id: '2', name: 'Inativa', user: 'inativa', pass: 'segredo', region: 'Serra', status: 'INATIVO' },
  ],
  stores: [
    { id: '10', name: 'Loja com rota', region: 'Vitoria', responsible: 'Ativa', routePromoterId: '1', routePromoterIds: ['1'], routeDays: [1] },
    { id: '11', name: 'Loja sem agenda', region: 'Vitoria', responsible: 'Ativa', routePromoterId: '1', routePromoterIds: ['1'], routeDays: [] },
    { id: '12', name: 'Loja sem cadastro', region: 'Vitoria', responsible: 'Ausente', routePromoterId: '99', routePromoterIds: ['99'], routeDays: [1] },
  ],
  timestamp: now.toISOString(),
};

const visit = (overrides: Partial<VisitSummary>): VisitSummary => ({
  visitId: 'VISIT-1',
  createdAt: '2026-08-17T10:00:00.000Z',
  updatedAt: '2026-08-17T14:00:00.000Z',
  syncStatus: 'enviado',
  syncError: null,
  photoCount: 4,
  taskCount: 5,
  payload: { user: { id: '1', name: 'Ativa' }, currentStore: 'Loja com rota' },
  ...overrides,
});

test('resume integridade cadastral e sincronizacao sem carregar fotos', () => {
  const result = buildOperationsHealth(data, [
    visit({}),
    visit({ visitId: 'VISIT-2', syncStatus: 'erro', syncError: 'Make HTTP 500 em https://segredo.exemplo/webhook' }),
  ], '2', now);

  assert.equal(result.status, 'attention');
  assert.equal(result.source.storeCount, 3);
  assert.equal(result.source.storesWithoutSchedule, 1);
  assert.deepEqual(result.source.invalidAssignmentIds, ['99']);
  assert.equal(result.synchronization.statuses.enviado, 1);
  assert.equal(result.synchronization.statuses.erro, 1);
  assert.equal(result.synchronization.issues[0].error?.includes('segredo.exemplo'), false);
  assert.equal('photos' in result.synchronization.issues[0], false);
});

test('sinaliza envio parado e snapshot abaixo do minimo', () => {
  const result = buildOperationsHealth(data, [
    visit({ syncStatus: 'enviando', updatedAt: '2026-08-17T13:00:00.000Z' }),
  ], '4', now);

  assert.equal(result.status, 'critical');
  assert.equal(result.synchronization.staleSending, 1);
  assert.equal(result.source.minimumStoreCount, 4);
});
