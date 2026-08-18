import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDefaultRetryCount,
  isRetryableHttpStatus,
  shouldExpireAuthSession,
} from '../src/services/httpPolicy.ts';

test('repete somente leituras idempotentes por padrao', () => {
  assert.equal(getDefaultRetryCount('GET'), 1);
  assert.equal(getDefaultRetryCount('HEAD'), 1);
  assert.equal(getDefaultRetryCount('POST'), 0);
  assert.equal(getDefaultRetryCount('PATCH'), 0);
});

test('reconhece apenas falhas HTTP transitorias para retry', () => {
  assert.equal(isRetryableHttpStatus(502), true);
  assert.equal(isRetryableHttpStatus(503), true);
  assert.equal(isRetryableHttpStatus(504), true);
  assert.equal(isRetryableHttpStatus(401), false);
  assert.equal(isRetryableHttpStatus(500), false);
});

test('encerra sessao somente em 401 de rota autenticada', () => {
  assert.equal(shouldExpireAuthSession(true, 401), true);
  assert.equal(shouldExpireAuthSession(false, 401), false);
  assert.equal(shouldExpireAuthSession(true, 503), false);
  assert.equal(shouldExpireAuthSession(true, 0), false);
});
