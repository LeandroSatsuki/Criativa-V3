import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_MAKE_REQUEST_TIMEOUT_MS,
  parseMakeRequestTimeoutMs,
} from '../netlify/functions/_shared/make-timeout.ts';

test('mantem 45 segundos como timeout padrao do Make', () => {
  assert.equal(parseMakeRequestTimeoutMs(), DEFAULT_MAKE_REQUEST_TIMEOUT_MS);
  assert.equal(parseMakeRequestTimeoutMs('invalido'), DEFAULT_MAKE_REQUEST_TIMEOUT_MS);
  assert.equal(parseMakeRequestTimeoutMs('499'), DEFAULT_MAKE_REQUEST_TIMEOUT_MS);
  assert.equal(parseMakeRequestTimeoutMs('60001'), DEFAULT_MAKE_REQUEST_TIMEOUT_MS);
});

test('aceita timeout reduzido somente dentro dos limites de seguranca', () => {
  assert.equal(parseMakeRequestTimeoutMs('500'), 500);
  assert.equal(parseMakeRequestTimeoutMs('1000'), 1000);
  assert.equal(parseMakeRequestTimeoutMs('45000'), 45000);
  assert.equal(parseMakeRequestTimeoutMs('60000'), 60000);
});
