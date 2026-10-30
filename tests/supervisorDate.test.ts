import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSupervisorDate } from '../netlify/functions/_shared/supervisor-date.ts';

const now = new Date('2026-09-28T15:00:00-03:00');

test('seleciona hoje por padrao e aceita dia anterior em Brasilia', () => {
  assert.deepEqual(resolveSupervisorDate(null, now), {
    date: '2026-09-28',
    selected: new Date('2026-09-28T12:00:00-03:00'),
    historical: false,
  });
  assert.equal(resolveSupervisorDate('2026-09-27', now)?.historical, true);
});

test('rejeita dia inexistente, futuro e texto fora do formato', () => {
  assert.equal(resolveSupervisorDate('2026-02-30', now), null);
  assert.equal(resolveSupervisorDate('2026-09-29', now), null);
  assert.equal(resolveSupervisorDate('2026-09-28&admin=true', now), null);
});
