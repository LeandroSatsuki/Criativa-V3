import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { evidenceTransaction } from '../src/services/durableStorage.ts';
import { storeLocalPhoto, readLocalPhoto } from '../src/services/litePhotos.ts';

test('solicita gravacao estrita, com fallback apenas quando opcoes nao sao suportadas', () => {
  for (const unsupported of [new TypeError('unsupported'), new DOMException('unsupported', 'NotSupportedError')]) {
    const calls: unknown[][] = [];
    const transaction = {};
    const database = { transaction: (...args: unknown[]) => {
      calls.push(args);
      if (args.length === 3) throw unsupported;
      return transaction;
    } } as unknown as IDBDatabase;
    assert.equal(evidenceTransaction(database, ['photos']), transaction);
    assert.deepEqual(calls, [[['photos'], 'readwrite', { durability: 'strict' }], [['photos'], 'readwrite']]);
  }
});

test('erro real de quota, banco ou encerramento nao e contornado como incompatibilidade', () => {
  for (const name of ['QuotaExceededError', 'InvalidStateError', 'AbortError', 'UnknownError']) {
    const error = new DOMException('synthetic', name);
    let calls = 0;
    const database = { transaction: () => { calls++; throw error; } } as unknown as IDBDatabase;
    assert.throws(() => evidenceTransaction(database, 'photos'), (actual) => actual === error);
    assert.equal(calls, 1);
  }
});

test('foto so retorna referencia apos commit estrito e releitura da imagem do mesmo dono', async () => {
  const original = IDBDatabase.prototype.transaction;
  const modes: string[] = [];
  IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
    if (this.name === 'criativa-lite-photos') {
      if (args[1] === 'readwrite') assert.equal(args[2]?.durability, 'strict');
      modes.push(args[1] || 'readonly');
    }
    return original.apply(this, args);
  };
  try {
    const ref = await storeLocalPhoto('durable-owner', 'foto-integra');
    assert.deepEqual(modes.slice(-2), ['readwrite', 'readonly']);
    assert.equal(await readLocalPhoto('durable-owner', ref), 'foto-integra');
  } finally { IDBDatabase.prototype.transaction = original; }
});

test('releitura ausente ou divergente rejeita captura sem excluir o arquivo gravado', async () => {
  const originalGet = IDBObjectStore.prototype.get;
  const originalAdd = IDBObjectStore.prototype.add;
  for (const replacement of [undefined, { ownerId: 'verify-owner', base64: 'conteudo-divergente' }]) {
    let savedId = '';
    IDBObjectStore.prototype.add = function (value: any, key?: IDBValidKey) {
      if (this.name === 'photos') savedId = value.id;
      return originalAdd.call(this, value, key);
    };
    IDBObjectStore.prototype.get = function (key: IDBValidKey | IDBKeyRange) {
      const request = originalGet.call(this, key);
      if (this.name === 'photos') request.addEventListener('success', () => Object.defineProperty(request, 'result', { value: replacement }));
      return request;
    };
    try {
      await assert.rejects(storeLocalPhoto('verify-owner', 'original-preservado'), /indisponivel|confirmar/);
    } finally {
      IDBObjectStore.prototype.get = originalGet;
      IDBObjectStore.prototype.add = originalAdd;
    }
    assert.equal(await readLocalPhoto('verify-owner', savedId), 'original-preservado');
  }
});
