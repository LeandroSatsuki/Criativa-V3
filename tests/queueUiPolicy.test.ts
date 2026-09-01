import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('fila pendente permite continuar trabalhando sem apagar registros', async () => {
  const app = await readSource('../src/App.tsx');
  const contentArea = await readSource('../src/components/ContentArea.tsx');
  const queue = await readSource('../src/services/syncQueue.ts');

  assert.match(app, /Continuar trabalhando/);
  assert.match(app, /registros permanecem salvos/i);
  assert.doesNotMatch(app, /Limpar minha fila|clearCurrentUserQueue/);
  assert.doesNotMatch(contentArea, /Limpar minha fila|handleClearQueue/);
  assert.doesNotMatch(queue, /clearQueuedVisits/);
});

test('consultas recorrentes usam indice leve e carregam uma visita por vez', async () => {
  const app = await readSource('../src/App.tsx');
  const contentArea = await readSource('../src/components/ContentArea.tsx');

  assert.match(app, /listQueuedVisitSummaries/);
  assert.match(app, /getQueuedVisit\(ownerId, queuedSummary\.visitId\)/);
  assert.doesNotMatch(app, /listQueuedVisits/);
  assert.match(contentArea, /getQueuedVisit\(queueOwnerId, queuedSummary\.visitId\)/);
  assert.doesNotMatch(contentArea, /listQueuedVisits/);
});

test('voltar da visita preserva o rascunho e cancelar nao remove a fila de envios', async () => {
  const contentArea = await readSource('../src/components/ContentArea.tsx');

  assert.match(contentArea, /Voltar mantendo o registro/);
  assert.match(contentArea, /navigateTo\(SectionId\.CheckIn\)/);
  assert.match(contentArea, /Cancelar registro/);
  assert.match(contentArea, /onReset\(\)/);
  assert.match(contentArea, /hasActiveVisit && !isCurrentStore/);
  assert.doesNotMatch(contentArea, /showVisitExitDialog[\s\S]{0,4000}removeQueuedVisit/);
});
