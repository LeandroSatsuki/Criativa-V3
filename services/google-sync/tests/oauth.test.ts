import assert from 'node:assert/strict';
import test from 'node:test';
import { google } from 'googleapis';
import {
  buildAuthorizationUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeAndStoreRefreshToken,
  type OAuthStateStore,
} from '../src/oauth.ts';

class MemoryStateStore implements OAuthStateStore {
  states = new Map<string, { expiresAt: Date; used: boolean }>();
  async create(nonce: string, expiresAt: Date) { this.states.set(nonce, { expiresAt, used: false }); }
  async consume(nonce: string, now: Date) {
    const state = this.states.get(nonce);
    if (!state || state.used || state.expiresAt < now) return false;
    state.used = true;
    return true;
  }
}

test('estado OAuth e assinado, expira e so pode ser usado uma vez', async () => {
  const store = new MemoryStateStore();
  const now = new Date('2026-08-19T12:00:00.000Z');
  const state = await createOAuthState('segredo-forte', store, now);

  assert.equal(await consumeOAuthState(`${state}x`, 'segredo-forte', store, now), false);
  assert.equal(await consumeOAuthState(state, 'segredo-forte', store, now), true);
  assert.equal(await consumeOAuthState(state, 'segredo-forte', store, now), false);

  const expired = await createOAuthState('segredo-forte', store, now);
  assert.equal(await consumeOAuthState(expired, 'segredo-forte', store, new Date(now.getTime() + 600_001)), false);
});

test('URL solicita acesso offline apenas a Drive file e Sheets', async () => {
  const client = new google.auth.OAuth2('client-id', 'client-secret', 'https://example.test/oauth/callback');
  const url = new URL(buildAuthorizationUrl(client, 'state-assinado'));

  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.has('include_granted_scopes'), false);
  assert.equal(url.searchParams.get('state'), 'state-assinado');
  assert.match(url.searchParams.get('scope') || '', /drive\.file/);
  assert.match(url.searchParams.get('scope') || '', /spreadsheets/);
  assert.doesNotMatch(url.searchParams.get('scope') || '', /auth\/drive(\s|$)/);
});

test('refresh token vai direto para Secret Manager e nao e retornado', async () => {
  const written: string[] = [];
  const client = {
    getToken: async () => ({ tokens: { refresh_token: 'refresh-secreto' } }),
  } as unknown as InstanceType<typeof google.auth.OAuth2>;

  await exchangeAndStoreRefreshToken(client, 'codigo-unico', {
    addSecretVersion: async (name, value) => { written.push(`${name}:${value}`); },
  }, 'projects/test/secrets/refresh');

  assert.deepEqual(written, ['projects/test/secrets/refresh:refresh-secreto']);
});
