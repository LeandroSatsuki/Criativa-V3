import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatBrasiliaDate,
  formatBrasiliaTime,
  formatFileDate,
  getBrasiliaISO,
  parseBrasiliaDate,
} from '../netlify/functions/_shared/time.ts';

test('interpreta horario legado sem fuso como horario de Brasilia', () => {
  const parsed = parseBrasiliaDate('2026-08-13T10:37:00');

  assert.equal(parsed.toISOString(), '2026-08-13T13:37:00.000Z');
  assert.equal(formatBrasiliaTime('2026-08-13T10:37:00'), '10:37');
});

test('converte instantes UTC e com offset para o horario de Brasilia', () => {
  assert.equal(formatBrasiliaTime('2026-08-13T13:37:00.000Z'), '10:37');
  assert.equal(formatBrasiliaTime('2026-08-13T10:37:00-03:00'), '10:37');
  assert.equal(formatBrasiliaDate('2026-08-14T01:30:00.000Z'), '13/08/2026');
  assert.equal(formatFileDate('2026-08-14T01:30:00.000Z'), '13-08-2026');
});

test('gera timestamp de Brasilia com offset explicito', () => {
  const timestamp = getBrasiliaISO();

  assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
  assert.ok(Math.abs(Date.parse(timestamp) - Date.now()) < 2_000);
});
