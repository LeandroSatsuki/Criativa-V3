import assert from 'node:assert/strict';
import test from 'node:test';
import type { SectionId } from '../src/types.ts';
import { resolveSessionSection } from '../src/services/navigationPolicy.ts';

const DEPOIS = 'DEPOIS' as SectionId;

test('sessao restaurada de supervisor abre o painel de gestao', () => {
  assert.equal(
    resolveSessionSection('SUPERVISOR', DEPOIS),
    'SUPERVISOR',
  );
});

test('sessao restaurada de promotor preserva a etapa salva', () => {
  assert.equal(
    resolveSessionSection('FIELD_OPS', DEPOIS),
    DEPOIS,
  );
});

test('promotor sem etapa salva inicia no painel geral', () => {
  assert.equal(resolveSessionSection('FIELD_OPS'), 'DASHBOARD');
});
