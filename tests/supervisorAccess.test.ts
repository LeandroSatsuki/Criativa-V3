import assert from 'node:assert/strict';
import test from 'node:test';
import { getSupervisorAccessError } from '../netlify/functions/_shared/supervisor-access.ts';

test('sessao ausente recebe 401 e nao e confundida com falta de papel', () => {
  assert.deepEqual(getSupervisorAccessError(null), {
    status: 401,
    message: 'Sessão inválida ou expirada. Faça login novamente.',
  });
});

test('promotor autenticado recebe 403 ao acessar painel supervisor', () => {
  assert.deepEqual(getSupervisorAccessError({ role: 'FIELD_OPS' }), {
    status: 403,
    message: 'Acesso restrito ao supervisor',
  });
});

test('supervisor autenticado tem acesso ao painel', () => {
  assert.equal(getSupervisorAccessError({ role: 'SUPERVISOR' }), null);
});
