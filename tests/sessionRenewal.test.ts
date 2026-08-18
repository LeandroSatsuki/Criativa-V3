import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SESSION_TTL_MS,
  renewSessionExpiration,
} from '../netlify/functions/_shared/session-policy.ts';

test('renova a sessao por sete dias sem substituir o acesso ativo', () => {
  const now = Date.parse('2026-08-17T12:00:00.000Z');
  const payload = {
    sub: 'PROMOTOR-1',
    name: 'Promotor Teste',
    role: 'FIELD_OPS',
    user: 'promotor.teste',
    sid: 'sessao-do-aparelho',
    exp: now + 1000,
  };

  const renewed = renewSessionExpiration(payload, now);

  assert.equal(renewed.sid, payload.sid);
  assert.equal(renewed.sub, payload.sub);
  assert.equal(renewed.exp, now + SESSION_TTL_MS);
  assert.equal(SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000);
});
