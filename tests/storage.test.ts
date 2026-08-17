import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isExpiredNetlifyBlobTokenError,
  withFreshNetlifyStore,
} from '../netlify/functions/_shared/storage.ts';

test('renova o store e repete uma vez quando o token interno do Blobs expira', async () => {
  let storesCreated = 0;
  let attempts = 0;

  const result = await withFreshNetlifyStore(
    'test-store',
    async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('Netlify Blobs internal error (Failed to decode token: Token expired)');
      }
      return 'ok';
    },
    () => {
      storesCreated += 1;
      return {} as any;
    },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 2);
  assert.equal(storesCreated, 2);
});

test('nao repete operacoes quando a falha nao e expiracao do token do Blobs', async () => {
  let storesCreated = 0;
  let attempts = 0;

  await assert.rejects(
    withFreshNetlifyStore(
      'test-store',
      async () => {
        attempts += 1;
        throw new Error('storage unavailable');
      },
      () => {
        storesCreated += 1;
        return {} as any;
      },
    ),
    /storage unavailable/,
  );

  assert.equal(attempts, 1);
  assert.equal(storesCreated, 1);
});

test('reconhece somente a mensagem especifica de token interno expirado', () => {
  assert.equal(
    isExpiredNetlifyBlobTokenError(new Error('Failed to decode token: Token expired')),
    true,
  );
  assert.equal(isExpiredNetlifyBlobTokenError(new Error('Token de sessao expirado')), false);
  assert.equal(isExpiredNetlifyBlobTokenError('Failed to decode token: Token expired'), false);
});
