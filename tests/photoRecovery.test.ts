import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoRecoveryHandler } from '../netlify/functions/_shared/photo-recovery.ts';
import { photoRecoverySlots } from '../src/services/photoRecoverySlots.ts';
const ref = 'criativa-photo-v1:101:12345678-1234-4234-8234-123456789012';
const jpeg = Buffer.from([255, 216, 255, 224, 0, 1, 255, 217]).toString('base64');
test('lista de recuperacao preserva categorias/industrias e deduplica aliases sem alterar payload', () => {
  const payload = { photos: { ESTOQUE: [ref] }, industryExecutions: { TESTE: { photos: { ESTOQUE: [ref], ANTES: ['legacy-base64'] } } } };
  const before = structuredClone(payload);
  assert.deepEqual(photoRecoverySlots(payload), [{ photoId: ref, section: 'ESTOQUE', industry: 'TESTE', number: 1 }]);
  assert.deepEqual(payload, before);
});
const fixture = (auth: { sub: string; role: string } | null = { sub: '101', role: 'FIELD_OPS' }) => {
  const photos = new Map<string, any>(), diagnostics = new Map<string, any>();
  const store = (map: Map<string, any>) => ({ get: async <T>(key: string): Promise<T | null> => map.get(key) || null, set: async (key: string, value: unknown) => { map.set(key, structuredClone(value)); }, list: async (prefix: string) => [...map.keys()].filter(key => key.startsWith(prefix)) });
  const handler = createPhotoRecoveryHandler({ authenticate: async () => auth, photos: store(photos), diagnostics: store(diagnostics) });
  const call = (body: unknown, method = 'POST') => handler(new Request('https://isolated.invalid/api/photos/recovery', { method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }));
  return { photos, diagnostics, call };
};
test('recuperacao exige autenticacao, conta piloto e papel correto', async () => {
  for (const [auth, status] of [[null, 401], [{ sub: 'other', role: 'FIELD_OPS' }, 403], [{ sub: '101', role: 'SUPERVISOR' }, 403]] as const) {
    const f = fixture(auth); assert.equal((await f.call({ action: 'read', photoId: ref })).status, status); assert.equal(f.photos.size, 0);
  }
  assert.equal((await fixture().call({}, 'GET')).status, 405);
});
test('copia confirmada, idempotente e privada pode recuperar foto pelo mesmo dono', async () => {
  const f = fixture(), body = { action: 'save', photoId: ref, visitId: 'VISIT-RECOVERY', base64: jpeg };
  assert.equal((await f.call({ action: 'read', photoId: ref })).status, 404);
  assert.equal((await f.call(body)).status, 200); assert.equal((await f.call(body)).status, 200); assert.equal(f.photos.size, 1);
  const response = await f.call({ action: 'read', photoId: ref }); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).base64, jpeg);
  assert.equal((await f.call({ action: 'read', photoId: ref.replace(':101:', ':other:') })).status, 400);
});
test('imagem divergente nao substitui original e copia corrompida nao e devolvida', async () => {
  const f = fixture(), body = { action: 'save', photoId: ref, visitId: 'VISIT-RECOVERY', base64: jpeg };
  await f.call(body);
  assert.equal((await f.call({ ...body, base64: Buffer.from([255, 216, 255, 99]).toString('base64') })).status, 409);
  assert.equal([...f.photos.values()][0].base64, jpeg);
  [...f.photos.values()][0].base64 = 'corrupted';
  assert.equal((await f.call({ action: 'read', photoId: ref })).status, 409);
});
test('limites e diagnostico recusam excesso e nao armazenam imagens ou credenciais no relatorio', async () => {
  const f = fixture(), body = { action: 'save', photoId: ref, visitId: 'VISIT-RECOVERY' };
  assert.equal((await f.call({ ...body, base64: Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(123000)]).toString('base64') })).status, 413);
  assert.equal((await f.call({ ...body, base64: 'not-jpeg' })).status, 400);
  assert.equal((await f.call({ ...body, visitId: '../x', base64: jpeg })).status, 400);
  assert.equal((await f.call({ action: 'diagnostic', visitId: 'VISIT-RECOVERY', items: [{ photoId: ref, status: 'missing', base64: jpeg, password: 'do-not-store' }], token: 'do-not-store' })).status, 200);
  const report = JSON.stringify([...f.diagnostics.values()]); assert.equal(report.includes(jpeg), false); assert.equal(report.includes('do-not-store'), false);
});
