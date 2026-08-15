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
    resolveSessionSection('FIELD_OPS', DEPOIS, true),
    DEPOIS,
  );
});

test('promotor sem visita ativa inicia no processo da visita', () => {
  assert.equal(resolveSessionSection('FIELD_OPS'), 'DASHBOARD');
  assert.equal(resolveSessionSection('FIELD_OPS', DEPOIS, false), 'DASHBOARD');
});
