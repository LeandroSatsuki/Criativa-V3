import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_MIN_STORE_COUNT,
  hasMinimumStoreCoverage,
  resolveMinimumStoreCount,
} from '../netlify/functions/_shared/config-integrity.ts';

test('protege a base contra snapshots de lojas truncados por filtro', () => {
  assert.equal(hasMinimumStoreCoverage(DEFAULT_MIN_STORE_COUNT), true);
  assert.equal(hasMinimumStoreCoverage(DEFAULT_MIN_STORE_COUNT - 1), false);
  assert.equal(hasMinimumStoreCoverage(5), false);
});

test('aceita limite operacional configurado explicitamente', () => {
  assert.equal(resolveMinimumStoreCount('150'), 150);
  assert.equal(hasMinimumStoreCoverage(154, '150'), true);
  assert.equal(hasMinimumStoreCoverage(149, '150'), false);
});

test('usa limite seguro quando a configuracao e invalida', () => {
  assert.equal(resolveMinimumStoreCount('0'), DEFAULT_MIN_STORE_COUNT);
  assert.equal(resolveMinimumStoreCount('-1'), DEFAULT_MIN_STORE_COUNT);
  assert.equal(resolveMinimumStoreCount('invalido'), DEFAULT_MIN_STORE_COUNT);
});
