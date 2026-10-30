import assert from 'node:assert/strict';
import test from 'node:test';
import { isStaleSync, STALE_SYNC_AGE_MS } from '../src/services/syncAge.ts';

test('alerta somente pendencia local com pelo menos 24 horas', () => {
  const now = Date.parse('2026-09-28T12:00:00.000Z');
  assert.equal(isStaleSync(new Date(now - STALE_SYNC_AGE_MS).toISOString(), now), true);
  assert.equal(isStaleSync(new Date(now - STALE_SYNC_AGE_MS + 1).toISOString(), now), false);
  assert.equal(isStaleSync('data-invalida', now), false);
});
