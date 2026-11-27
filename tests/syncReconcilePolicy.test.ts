import assert from 'node:assert/strict';
import test from 'node:test';
import { selectVisitForReconciliation, resolveReconciliationCandidate } from '../netlify/functions/_shared/sync-reconcile-policy.ts';
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

test('seleciona erro historico de confirmacao de foto para recuperacao', () => {
  const selected = selectVisitForReconciliation([
    summary('ERRO-GENERICO', 'erro', 60, 'Make retornou HTTP 500'),
    summary('FOTO-LEGADA', 'erro', 20, 'Make não confirmou o upload da foto no Google Drive.'),
  ], now);
  assert.equal(selected?.visitId, 'FOTO-LEGADA');
});

test('indice antigo concluido nao bloqueia a proxima visita; trabalho recente nao e repetido', async () => {
  const old = summary('CONCLUIDO', 'enviando', 100);
  const recent = summary('RECENTE', 'enviando', 40);
  const pending = summary('PENDENTE', 'pendente', 20);
  const records = new Map([
    [old.visitId, { ...old, syncStatus: 'enviado' as const }],
    [recent.visitId, { ...recent, updatedAt: new Date(now).toISOString() }],
    [pending.visitId, pending],
  ]);
  const repaired: string[] = [];
  const selected = await resolveReconciliationCandidate([old, recent, pending], {
    get: async id => records.get(id) || null,
    summarize: record => record,
    repairCompleted: async record => { repaired.push(record.visitId); },
  }, now);
  assert.deepEqual(repaired, ['CONCLUIDO']);
  assert.equal(selected?.visitId, 'PENDENTE');
});

test('limita leituras por execucao e preserva entrada cujo registro nao foi encontrado', async () => {
  let reads = 0, repairs = 0;
  const selected = await resolveReconciliationCandidate(Array.from({ length: 20 }, (_, i) => summary(String(i), 'enviando', 100 - i)), {
    get: async () => { reads++; return null as VisitSummary | null; },
    summarize: record => record,
    repairCompleted: async () => { repairs++; },
  }, now);
  assert.equal(selected, null); assert.equal(reads, 8); assert.equal(repairs, 0);
});
