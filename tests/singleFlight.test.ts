import assert from 'node:assert/strict';
import test from 'node:test';
import { createSingleFlight } from '../src/services/singleFlight.ts';

test('eventos simultaneos compartilham uma operacao e nao guardam resultado apos concluir', async () => {
  const run = createSingleFlight<number>(); let calls = 0, release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const first = run('owner', async () => { calls++; await wait; return 7; });
  const duplicates = Array.from({ length: 30 }, () => run('owner', async () => { throw Error('duplicou'); }));
  assert.ok(duplicates.every(promise => promise === first));
  release(); assert.deepEqual(await Promise.all(duplicates), Array(30).fill(7)); assert.equal(calls, 1);
  assert.equal(await run('owner', async () => 8), 8);
});

test('falha libera a chave e contas distintas nao compartilham respostas', async () => {
  const run = createSingleFlight<string>();
  const failure = run('a', async () => { throw Error('offline'); });
  const sameFailure = run('a', async () => 'nao executar');
  assert.equal(failure, sameFailure); await assert.rejects(failure, /offline/);
  assert.equal(await run('a', async () => 'recuperado'), 'recuperado');
  assert.deepEqual(await Promise.all([run('a', async () => 'conta-a'), run('b', async () => 'conta-b')]), ['conta-a', 'conta-b']);
});
