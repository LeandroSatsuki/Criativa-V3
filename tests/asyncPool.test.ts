import assert from 'node:assert/strict';
import test from 'node:test';
import { mapWithConcurrency } from '../netlify/functions/_shared/async-pool.ts';

test('limita concorrencia e preserva a ordem dos resultados', async () => {
  let active = 0;
  let maxActive = 0;
  const values = Array.from({ length: 17 }, (_, index) => index);

  const result = await mapWithConcurrency(values, 4, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, value % 3));
    active -= 1;
    return value * 2;
  });

  assert.equal(maxActive, 4);
  assert.deepEqual(result, values.map((value) => value * 2));
});

test('rejeita configuracao de concorrencia invalida', async () => {
  await assert.rejects(() => mapWithConcurrency([1], 0, async (value) => value), /Concorrencia invalida/);
});
