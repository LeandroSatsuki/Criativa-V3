import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPERATIONAL_CACHE_MAX_AGE_MS,
  buildOperationalCacheKey,
  isOperationalCacheFresh,
  parseOperationalCache,
  readOperationalCache,
  writeOperationalCache,
} from '../src/services/operationalCache.ts';
import { isNetworkRequestFailure } from '../src/services/networkStatus.ts';
import { classifyQueuedSyncFailure } from '../src/services/syncPolicy.ts';

const now = Date.parse('2026-08-04T15:00:00.000Z');

const buildRecord = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  version: 1,
  ownerId: 'PROMOTOR-1',
  ownerRole: 'FIELD_OPS',
  cachedAt: new Date(now - 1000).toISOString(),
  stores: [{ id: 'LOJA-1', name: 'Loja autorizada' }],
  industries: ['Industria A'],
  ...overrides,
});

test('cache operacional e isolado pelo identificador completo do usuario', () => {
  assert.equal(
    buildOperationalCacheKey('PROMOTOR 1'),
    'CRIATIVA_OPERATIONAL_CACHE_V1:PROMOTOR%201',
  );
  assert.equal(
    buildOperationalCacheKey('PROMOTOR/2'),
    'CRIATIVA_OPERATIONAL_CACHE_V1:PROMOTOR%2F2',
  );
});

test('aceita cadastro operacional por ate sete dias', () => {
  assert.equal(
    isOperationalCacheFresh(
      new Date(now - OPERATIONAL_CACHE_MAX_AGE_MS + 1).toISOString(),
      now,
    ),
    true,
  );
  assert.equal(
    isOperationalCacheFresh(
      new Date(now - OPERATIONAL_CACHE_MAX_AGE_MS).toISOString(),
      now,
    ),
    false,
  );
});

test('rejeita cache de outro usuario, supervisor, futuro ou expirado', () => {
  assert.equal(parseOperationalCache(buildRecord(), 'PROMOTOR-2', now), null);
  assert.equal(
    parseOperationalCache(buildRecord({ ownerRole: 'SUPERVISOR' }), 'PROMOTOR-1', now),
    null,
  );
  assert.equal(
    parseOperationalCache(
      buildRecord({ cachedAt: new Date(now + 1).toISOString() }),
      'PROMOTOR-1',
      now,
    ),
    null,
  );
  assert.equal(
    parseOperationalCache(
      buildRecord({ cachedAt: new Date(now - OPERATIONAL_CACHE_MAX_AGE_MS).toISOString() }),
      'PROMOTOR-1',
      now,
    ),
    null,
  );
});

test('preserva lojas e industrias somente do promotor autenticado', () => {
  const cached = parseOperationalCache(buildRecord(), 'PROMOTOR-1', now);

  assert.deepEqual(cached?.stores, [{ id: 'LOJA-1', name: 'Loja autorizada' }]);
  assert.deepEqual(cached?.industries, ['Industria A']);
});

test('fallback offline nao mascara erro HTTP ou de autorizacao', () => {
  assert.equal(isNetworkRequestFailure(new TypeError('Failed to fetch'), true), true);
  assert.equal(isNetworkRequestFailure(new Error('Nao autorizado'), true), false);
  assert.equal(isNetworkRequestFailure(new Error('qualquer erro'), false), true);
});

test('falha de rede mantem visita pendente e libera nova operacao', () => {
  assert.deepEqual(
    classifyQueuedSyncFailure(new TypeError('Failed to fetch'), true),
    {
      status: 'pending',
      message: 'Sem conexão. Visita salva no aparelho e aguardando envio.',
      releaseVisit: true,
    },
  );
});

test('erro HTTP permanece visivel e nao libera o rascunho atual', () => {
  assert.deepEqual(
    classifyQueuedSyncFailure(new Error('Não autorizado'), true),
    {
      status: 'error',
      message: 'Não autorizado',
      releaseVisit: false,
    },
  );
});

test('grava e restaura o cadastro do promotor no armazenamento do aparelho', () => {
  const values = new Map<string, string>();
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });

  try {
    assert.equal(
      writeOperationalCache(
        'PROMOTOR-1',
        'FIELD_OPS',
        [{ id: 'LOJA-1' }],
        ['Industria A'],
      ),
      true,
    );
    const cached = readOperationalCache('PROMOTOR-1');
    assert.deepEqual(cached?.stores, [{ id: 'LOJA-1' }]);
    assert.deepEqual(cached?.industries, ['Industria A']);
    assert.equal(readOperationalCache('PROMOTOR-2'), null);
  } finally {
    if (originalStorage) {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalStorage,
      });
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  }
});
