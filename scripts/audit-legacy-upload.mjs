// All requests stay on a temporary local server. Never uses a real session.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const oldPayload = { visitId: 'VISIT-LEGACY-AUDIT', user: { id: 'audit-upload' }, photos: { FACHADA: Array.from({ length: 100 }, (_, i) => `PHOTO:${i}:` + 'A'.repeat(120000)) } };
  const oldSerialized = JSON.stringify(oldPayload);
  // Simulate a fragment left by the previous production release, not by the
  // new implementation. A resume must remain byte-for-byte compatible.
  const chunks = new Map([[0, oldSerialized.slice(0, Math.floor(1.5 * 1024 * 1024))]]);
  let fail = true, duplicates = 0, finalized = 0, expectedHash = createHash('sha256').update(oldSerialized).digest('hex').slice(0, 32);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); assert.equal(url.origin, origin);
    if (url.pathname === '/audit-fixture') return route.fulfill({ contentType: 'text/html', body: '<html></html>' });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    assert.equal(url.pathname, '/api/visits/upload');
    const body = route.request().postDataJSON();
    if (body.action === 'status') { expectedHash ??= body.uploadId; assert.equal(body.uploadId, expectedHash); return route.fulfill({ json: { receivedIndexes: [...chunks.keys()] } }); }
    if (body.action === 'chunk') {
      if (body.index === 1 && fail) return route.abort('internetdisconnected');
      if (chunks.has(body.index)) duplicates++;
      chunks.set(body.index, body.chunk); return route.fulfill({ json: {} });
    }
    assert.equal(body.action, 'finalize');
    const text = [...chunks.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]).join('');
    assert.equal(createHash('sha256').update(text).digest('hex').slice(0, 32), expectedHash);
    const payload = JSON.parse(text); assert.equal(payload.photos.FACHADA.length, 100);
    assert.equal(payload.photos.FACHADA[99].slice(0, 6), 'PHOTO:');
    finalized++; return route.fulfill({ json: { visitId: body.visitId, syncStarted: true } });
  });
  await page.goto(origin + '/audit-fixture');
  const first = await page.evaluate(async () => {
    localStorage.setItem('criativa_session', JSON.stringify({ user: { id: 'audit-upload' }, token: 'local-only' }));
    window.api = (await import('/src/services/apiService.ts')).apiService;
    window.payload = { visitId: 'VISIT-LEGACY-AUDIT', user: { id: 'audit-upload' }, photos: { FACHADA: Array.from({ length: 100 }, (_, i) => `PHOTO:${i}:` + 'A'.repeat(120000)) } };
    window.wholePayloadSerializations = 0; window.maxEncodeBytes = 0;
    const stringify = JSON.stringify;
    JSON.stringify = function (value, ...rest) {
      if (value?.visitId === window.payload.visitId && value?.photos) window.wholePayloadSerializations++;
      return stringify(value, ...rest);
    };
    const encode = TextEncoder.prototype.encode;
    TextEncoder.prototype.encode = function (value) { const result = encode.call(this, value); window.maxEncodeBytes = Math.max(window.maxEncodeBytes, result.length); return result; };
    try { await window.api.createVisit(window.payload); return { failed: false }; }
    catch (error) { return { failed: true, message: error.message }; }
  });
  assert.equal(first.failed, true); assert.equal(finalized, 0); assert.equal(chunks.size, 1);
  fail = false;
  const result = await page.evaluate(async () => {
    const result = await window.api.createVisit(window.payload);
    return { visitId: result.visitId, wholePayloadSerializations: window.wholePayloadSerializations, maxEncodeBytes: window.maxEncodeBytes, photosPreserved: window.payload.photos.FACHADA.length };
  });
  assert.equal(result.wholePayloadSerializations, 0); assert.equal(result.photosPreserved, 100);
  assert.ok(result.maxEncodeBytes <= Math.floor(1.5 * 1024 * 1024));
  assert.equal(duplicates, 0); assert.equal(finalized, 1);
  console.log(JSON.stringify({ ...result, chunks: chunks.size, interruptedAndResumed: true, resumedPreviousRelease: true, duplicateChunks: duplicates, hashMatches: true, realRequests: false }));
} finally { await browser.close(); await server.close(); }
