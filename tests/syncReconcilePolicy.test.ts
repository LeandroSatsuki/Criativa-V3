import assert from 'node:assert/strict';
import test from 'node:test';
import { selectVisitForReconciliation } from '../netlify/functions/_shared/sync-reconcile-policy.ts';
import type { VisitSummary } from '../netlify/functions/_shared/visit-summary.ts';

const summary = (visitId: string, status: VisitSummary['syncStatus'], ageMinutes: number, error: string | null = null): VisitSummary => ({
  visitId,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 7, 31, 12, 0) - ageMinutes * 60_000).toISOString(),
  syncStatus: status,
  syncError: error,
  photoCount: 4,
  taskCount: 0,
  payload: {},
});

const now = Date.UTC(2026, 7, 31, 12, 0);

test('seleciona pendente antigo com fotos e sem erro', () => {
  const selected = selectVisitForReconciliation([
    summary('RECENTE', 'pendente', 5),
    summary('ANTIGO', 'pendente', 15),
  ], now);
  assert.equal(selected?.visitId, 'ANTIGO');
});

test('seleciona envio parado antes de pendente mais recente', () => {
  const selected = selectVisitForReconciliation([
    summary('PENDENTE', 'pendente', 15),
    summary('ENVIANDO', 'enviando', 40),
  ], now);
  assert.equal(selected?.visitId, 'ENVIANDO');
});

test('ignora fila recente, erro legado e visita sem foto', () => {
  const withoutPhotos = { ...summary('SEM-FOTO', 'pendente', 60), photoCount: 0 };
  const selected = selectVisitForReconciliation([
    summary('RECENTE', 'enviando', 2),
    summary('MAKE', 'pendente', 60, 'Make retornou HTTP 500'),
    withoutPhotos,
  ], now);
  assert.equal(selected, undefined);
});
