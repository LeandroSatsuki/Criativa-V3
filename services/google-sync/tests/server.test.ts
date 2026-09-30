import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server.ts';

const withServer = async (callback: (baseUrl: string) => Promise<void>) => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address() as AddressInfo;
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (
      error ? reject(error) : resolve()
    )));
  }
};

test('health identifica homologacao sem trafego ou Make', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      ok: true,
      service: 'criativa-google-sync',
      mode: 'homologation',
      role: 'health',
      acceptsTraffic: false,
      makeCalled: false,
    });
  });
});

test('nao expoe rota de ingestao antes da autenticacao', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ EVENT_TYPE: 'PHOTO_UPLOAD' }),
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
  });
});

test('ingresso rejeita chamada sem segredo', async () => {
  const server = createApp({ role: 'ingress', ingress: {} as any, ingressSecret: 'segredo-forte' })
    .listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/ingress/photo-batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: 'unauthorized' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (
      error ? reject(error) : resolve()
    )));
  }
});
