import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONFIG_CACHE_MAX_AGE_MS,
  isConfigCacheFresh,
} from '../netlify/functions/_shared/config-cache.ts';

const now = Date.parse('2026-08-03T15:00:00.000Z');

test('aceita cache cadastral dentro da validade', () => {
  const cachedAt = new Date(now - CONFIG_CACHE_MAX_AGE_MS + 1).toISOString();
  assert.equal(isConfigCacheFresh(cachedAt, now), true);
});

test('recarrega cache cadastral expirado', () => {
  const cachedAt = new Date(now - CONFIG_CACHE_MAX_AGE_MS).toISOString();
  assert.equal(isConfigCacheFresh(cachedAt, now), false);
});

test('rejeita cache sem data válida ou com relógio futuro', () => {
  assert.equal(isConfigCacheFresh(undefined, now), false);
  assert.equal(isConfigCacheFresh('data-invalida', now), false);
  assert.equal(isConfigCacheFresh(new Date(now + 1).toISOString(), now), false);
});
