import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVisitSummary,
  completeVisitSummaryIndex,
} from '../netlify/functions/_shared/visit-summary.ts';

test('resumo preserva dados operacionais sem carregar fotos ou base64', () => {
  const photo = 'data:image/jpeg;base64,FOTO-GRANDE';
  const summary = buildVisitSummary({
    visitId: 'VISIT-1',
    createdAt: '2026-08-17T08:00:00-03:00',
    updatedAt: '2026-08-17T09:00:00-03:00',
    syncStatus: 'enviado',
    payload: {
      user: { id: '3', user: 'promotora', name: 'Promotora', region: 'Vitoria' },
      currentStore: 'Loja Teste',
      currentStoreId: '10',
      checkInTime: '2026-08-17T08:00:00-03:00',
      checkOutTime: '2026-08-17T09:00:00-03:00',
      tasks: { ANTES: true, DEPOIS: true },
      photos: { FACHADA: [photo] },
      industryExecutions: {
        VENEZA: { photos: { ANTES: [photo, 'foto-2'], DEPOIS: ['foto-3'] } },
      },
    },
  });

  assert.equal(summary.photoCount, 3);
  assert.equal(summary.taskCount, 2);
  assert.equal(summary.payload.currentStoreId, '10');
  assert.doesNotMatch(JSON.stringify(summary), /base64|FOTO-GRANDE/);
});

test('indexa historico em lotes limitados e devolve somente indice completo', async () => {
  const keys = Array.from({ length: 9 }, (_, index) => `visits/VISIT-${index + 1}`);
  let activeLoads = 0;
  let maxActiveLoads = 0;
  const saved: string[] = [];

  const summaries = await completeVisitSummaryIndex(
    keys,
    [],
    async (key) => {
      activeLoads += 1;
      maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeLoads -= 1;
      const visitId = key.slice('visits/'.length);
      return {
        visitId,
        createdAt: '2026-08-17T08:00:00-03:00',
        updatedAt: '2026-08-17T09:00:00-03:00',
        syncStatus: 'enviado',
        payload: { currentStore: visitId },
      };
    },
    async (summary) => {
      saved.push(summary.visitId);
    },
    4,
  );

  assert.equal(summaries.length, 9);
  assert.equal(saved.length, 9);
  assert.equal(maxActiveLoads, 4);
  assert.deepEqual(summaries.map((summary) => summary.visitId), keys.map((key) => key.slice(7)));
});
