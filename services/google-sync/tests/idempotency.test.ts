import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimJob,
  completeJob,
  deterministicTaskName,
  failJob,
  stagingObjectName,
  type SyncJob,
} from '../src/idempotency.ts';

const pending = (): SyncJob => ({ id: 'foto-1', state: 'pending', attempts: 0 });
const now = new Date('2026-08-19T12:00:00.000Z');

test('gera o mesmo nome de tarefa para a mesma chave', () => {
  const first = deterministicTaskName('photo-upload', 'foto-1');
  const second = deterministicTaskName('photo-upload', 'foto-1');

  assert.equal(first, second);
  assert.notEqual(first, deterministicTaskName('photo-upload', 'foto-2'));
  assert.match(first, /^photo-upload-[a-f0-9]{64}$/);
});

test('nao expoe IDs operacionais no nome do objeto temporario', () => {
  const name = stagingObjectName('../visita sensivel', 'foto/com/barra');

  assert.match(name, /^staging\/[a-f0-9]{24}\/[a-f0-9]{64}\.jpg$/);
  assert.equal(name.includes('sensivel'), false);
});

test('adquire o job uma vez e bloqueia retry durante o lease', () => {
  const first = claimJob(pending(), now, 60_000, 5);
  assert.equal(first.action, 'claimed');
  if (first.action !== 'claimed') return;

  const retry = claimJob(first.job, new Date(now.getTime() + 10_000), 60_000, 5);
  assert.equal(retry.action, 'leased');
  assert.equal(retry.job.attempts, 1);
});

test('permite retomada depois da expiracao do lease', () => {
  const first = claimJob(pending(), now, 60_000, 5);
  assert.equal(first.action, 'claimed');
  if (first.action !== 'claimed') return;

  const retry = claimJob(first.job, new Date(now.getTime() + 60_001), 60_000, 5);
  assert.equal(retry.action, 'claimed');
  assert.equal(retry.job.attempts, 2);
});

test('job concluido devolve recibo sem novo processamento', () => {
  const first = claimJob(pending(), now, 60_000, 5);
  assert.equal(first.action, 'claimed');
  if (first.action !== 'claimed') return;

  const completed = completeJob(first.job, { fileId: 'drive-1' });
  const retry = claimJob(completed, new Date(now.getTime() + 120_000), 60_000, 5);

  assert.equal(retry.action, 'completed');
  assert.deepEqual(retry.job.receipt, { fileId: 'drive-1' });
  assert.equal(retry.job.attempts, 1);
});

test('interrompe retries no limite e sanitiza o erro', () => {
  const claimed = claimJob({ ...pending(), attempts: 4 }, now, 60_000, 5);
  assert.equal(claimed.action, 'claimed');
  if (claimed.action !== 'claimed') return;

  const failed = failJob(claimed.job, 'erro\ncom\tdetalhe', 5);
  assert.equal(failed.state, 'dead_letter');
  assert.equal(failed.lastError, 'erro com detalhe');

  const retry = claimJob(failed, new Date(now.getTime() + 120_000), 60_000, 5);
  assert.equal(retry.action, 'dead_letter');
});
