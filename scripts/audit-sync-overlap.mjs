// Reproduce focus/online/status overlap with a large local queue, no real API.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root = path.resolve('dist');
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname === '/fixture') { res.setHeader('Content-Type', 'text/html'); res.end('<html></html>'); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ serviceWorkers: 'block' }); page.setDefaultTimeout(10000);
  const user = { id: 'overlap-audit', name: 'TESTE ISOLADO', user: 'audit', role: 'FIELD_OPS' }, pending = [];
  let released = false, statusCalls = 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); assert.equal(url.origin, origin);
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data;
    if (url.pathname === '/api/config') data = { industries: ['TESTE'], timestamp: new Date().toISOString() };
    else if (url.pathname === '/api/stores') data = [{ id: 'store', name: 'LOJA TESTE' }];
    else if (url.pathname === '/api/auth/session') data = { user, token: 'local', expiresAt: '2099-01-01T00:00:00Z' };
    else if (url.pathname === '/api/sync/VISIT-OVERLAP/status') {
      statusCalls++; if (!released) await new Promise(resolve => pending.push(resolve));
      data = { syncStatus: 'enviado', progress: { total: 100, sent: 100 } };
    } else throw new Error('API inesperada: ' + url.pathname);
    await route.fulfill({ json: data });
  });
  await page.goto(origin + '/fixture');
  await page.evaluate(async user => {
    localStorage.setItem('criativa_session', JSON.stringify({ user, token: 'local', issuedAt: new Date().toISOString() }));
    const r = indexedDB.open('criativa-field-ops-sync', 1);
    await new Promise((resolve, reject) => {
      r.onupgradeneeded = () => r.result.createObjectStore('queued-visits', { keyPath: 'visitId' });
      r.onsuccess = () => { const db = r.result; const tx = db.transaction('queued-visits', 'readwrite'); tx.objectStore('queued-visits').put({ ownerId: user.id, visitId: 'VISIT-OVERLAP', payload: { user, currentStore: 'LOJA TESTE', photos: { ANTES: Array.from({ length: 100 }, (_, i) => `${i}-` + 'A'.repeat(120000)) } }, status: 'error', error: 'Teste isolado', attempts: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = tx.onerror = () => reject(tx.error); };
    });
  }, user);
  await page.addInitScript(() => {
    window.auditReads = 0;
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) { const r = get.apply(this, args); if (this.name === 'queued-visits') r.addEventListener('success', () => { window.auditReads++; }); return r; };
  });
  await page.goto(origin); await page.getByText('TESTE ISOLADO', { exact: false }).first().waitFor();
  await page.waitForTimeout(100);
  const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage');
  const before = await cdp.send('Runtime.getHeapUsage');
  await page.evaluate(() => { for (let i = 0; i < 15; i++) window.dispatchEvent(new Event(i % 2 ? 'focus' : 'online')); });
  await page.waitForTimeout(350);
  const simultaneousStatus = pending.length;
  let peak = before.usedSize;
  const sampler = setInterval(() => { void cdp.send('Runtime.getHeapUsage').then(h => { peak = Math.max(peak, h.usedSize); }).catch(() => {}); }, 20);
  released = true; for (const resolve of pending.splice(0)) resolve();
  await page.waitForFunction(() => new Promise(resolve => {
    const r = indexedDB.open('criativa-field-ops-sync'); r.onsuccess = () => { const db = r.result; const tx = db.transaction('queued-visits'); const q = tx.objectStore('queued-visits').count(); tx.oncomplete = () => { db.close(); resolve(q.result === 0); }; };
  }));
  await page.waitForTimeout(500); clearInterval(sampler);
  const reads = await page.evaluate(() => window.auditReads);
  await cdp.send('HeapProfiler.collectGarbage'); const after = await cdp.send('Runtime.getHeapUsage');
  console.log(JSON.stringify({ events: 15, statusCalls, simultaneousStatus, fullQueueReads: reads, jsHeapBefore: before.usedSize, jsHeapPeak: peak, jsHeapAfterGc: after.usedSize, queueRemovedAfterConfirmation: true, realRequests: false, note: 'Synthetic 12 MB local payload. Peak varies with GC and sampling; not device RAM.' }));
  if (process.env.EXPECT_DEDUP === 'true') { assert.ok(simultaneousStatus <= 1); assert.ok(reads <= 3); }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
