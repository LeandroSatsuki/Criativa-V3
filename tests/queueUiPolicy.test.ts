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
