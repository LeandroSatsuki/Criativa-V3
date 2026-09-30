import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMissingChunkIndexes,
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

test('retoma upload enviando somente fragmentos ausentes', () => {
  assert.deepEqual(getMissingChunkIndexes(5, [0, 2, 2, 9, -1]), [1, 3, 4]);
  assert.deepEqual(getMissingChunkIndexes(3, undefined), [0, 1, 2]);
});

test('contagem UTF-8 equivale ao encoder inclusive com surrogates isolados', () => {
  const encoder = new TextEncoder();
  for (const value of ['', 'ASCII', '\u00e3\u20ac', '\ud83d\ude00', '\ud800', '\udc00', '\ud800a\udc00', '\ud800\ud800\udc00']) {
    assert.equal(getUtf8ByteLength(value), encoder.encode(value).length);
  }
  for (let code = 0; code <= 0xffff; code += 1) {
    const value = String.fromCharCode(code);
    assert.equal(getUtf8ByteLength(value), encoder.encode(value).length);
  }
});

test('fragmentos continuam nos mesmos limites UTF-8 para retomar envios existentes', () => {
  const value = 'a\u00e3\u20ac\ud83d\ude00z\ud800b\udc00'.repeat(20);
  for (const limit of [4, 5, 7, 16, 31, 128]) {
    const expected: string[] = [];
    let current = '';
    for (const character of value) {
      if (Buffer.byteLength(current + character, 'utf8') > limit) {
        expected.push(current);
        current = '';
      }
      current += character;
    }
    expected.push(current);
    assert.deepEqual(splitUtf8Text(value, limit), expected);
  }
  assert.deepEqual(splitUtf8Text('', 1), ['']);
  assert.throws(() => splitUtf8Text('\ud83d\ude00', 3));
});

test('preparacao de payload grande nao aloca buffers UTF-8 temporarios', () => {
  const original = TextEncoder.prototype.encode;
  TextEncoder.prototype.encode = () => { throw new Error('Alocacao desnecessaria'); };
  try {
    const value = 'A'.repeat(12_000_000);
    assert.equal(getUtf8ByteLength(value), value.length);
    const chunks = splitUtf8Text(value);
    assert.equal(chunks.join(''), value);
    assert.equal(chunks.length, 8);
  } finally {
    TextEncoder.prototype.encode = original;
  }
});

