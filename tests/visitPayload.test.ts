import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getUtf8ByteLength,
  splitUtf8Text,
  VISIT_PAYLOAD_CHUNK_MAX_BYTES,
} from '../src/services/visitPayload.ts';

test('divide e remonta um payload grande sem alterar o conteúdo', () => {
  const payload = JSON.stringify({
    loja: 'Itapoã Supermercado - Mata da Praia',
    photos: Array.from({ length: 30 }, (_, index) => `${index}-😀-${'A'.repeat(350_000)}`),
  });

  const chunks = splitUtf8Text(payload);

  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(''), payload);
  chunks.forEach((chunk) => {
    assert.ok(getUtf8ByteLength(chunk) <= VISIT_PAYLOAD_CHUNK_MAX_BYTES);
  });
});

test('mantém payload pequeno em um único fragmento', () => {
  const payload = JSON.stringify({ visitId: 'VISIT-TESTE', photos: ['abc'] });
  assert.deepEqual(splitUtf8Text(payload), [payload]);
});

test('rejeita limite de fragmento inválido', () => {
  assert.throws(() => splitUtf8Text('payload', 0));
});

