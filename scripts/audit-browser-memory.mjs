// Isolated browser audit. All APIs are mocked; no production login or upload.
// Usage: node scripts/audit-browser-memory.mjs <absolute playwright/index.mjs>
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Informe o caminho absoluto do Playwright.');
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root = path.resolve('dist');
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/fixture') { res.setHeader('Content-Type', 'text/html'); res.end('<html></html>'); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream'] });
try {
  for (const mode of process.argv.includes('--recovery-only') ? [] : ['normal', 'lite']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (Linux; Android 12) Chrome/131.0.0.0 Mobile Safari/537.36' });
    try {
      const page = await context.newPage();
      const errors = [], dialogs = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
      const user = { id: 'isolated-memory-audit', name: 'AUDITORIA ISOLADA', role: 'FIELD_OPS', user: 'audit-local' };
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        assert.equal(url.origin, origin, 'Nenhuma conexao externa permitida');
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const data = url.pathname === '/api/config' ? { industries: ['TESTE'], timestamp: new Date().toISOString() }
          : url.pathname === '/api/stores' ? [{ id: 'audit-store', name: 'LOJA DE TESTE ISOLADO' }]
          : url.pathname === '/api/auth/session' ? { user, token: 'local-only', expiresAt: '2099-01-01T00:00:00Z' }
          : null;
        assert.notEqual(data, null, 'API inesperada: ' + url.pathname);
        await route.fulfill({ json: data });
      });
      await page.goto(origin + '/fixture');
      const fixture = await page.evaluate(async ({ mode, user }) => {
        const canvas = document.createElement('canvas'); canvas.width = 624; canvas.height = 832;
        const ctx = canvas.getContext('2d'); const pixels = ctx.createImageData(canvas.width, canvas.height);
        let seed = 42;
        for (let i = 0; i < pixels.data.length; i += 4) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          pixels.data[i] = seed & 255; pixels.data[i + 1] = (seed >>> 8) & 255; pixels.data[i + 2] = (seed >>> 16) & 255; pixels.data[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
        const jpeg = canvas.toDataURL('image/jpeg', 0.25).split(',')[1];
        const bytes = atob(jpeg);
        const photos = Array.from({ length: 100 }, (_, i) => btoa(bytes + `AUDIT-${i}`));
        const open = (name, version, upgrade) => new Promise((resolve, reject) => {
          const r = indexedDB.open(name, version); r.onupgradeneeded = () => upgrade(r.result);
          r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
        });
        const put = (db, store, values) => new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          for (const [key, value] of values) key === null ? tx.objectStore(store).put(value) : tx.objectStore(store).put(value, key);
          tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = tx.onerror = () => reject(tx.error);
        });
        let stored = photos;
        if (mode === 'lite') {
          localStorage.setItem('criativa_lite_enabled', 'true');
          stored = photos.map((_, i) => `criativa-photo-v1:${user.id}:audit-${i}`);
          const db = await open('criativa-lite-photos', 2, db => {
            db.createObjectStore('photos', { keyPath: 'id' }); db.createObjectStore('confirmed-visits', { keyPath: 'key' });
          });
          await put(db, 'photos', photos.map((base64, i) => [null, { id: stored[i], ownerId: user.id, base64, context: { visitId: 'VISIT-AUDIT', section: 'DEPOIS', industry: 'TESTE' } }]));
        }
        const executions = Object.fromEntries(['TESTE', 'TESTE-2', 'TESTE-3', 'TESTE-4'].map((industry, i) => [industry, {
          industry, status: 'aberto', tasks: { ANTES: true, TROCAS: true }, photos: { ANTES: stored.slice(i * 25, i * 25 + 20), DEPOIS: stored.slice(i * 25 + 20, i * 25 + 25) }, stockQuantities: {}, aiResults: {}, hasReturns: false,
        }]));
        const draft = { user, draftOwnerId: user.id, visitId: 'VISIT-AUDIT', currentStore: 'LOJA DE TESTE ISOLADO', currentStoreId: 'audit-store', step: 'DEPOIS', checkInDone: true, checkInTime: new Date().toISOString(), checkOutTime: null, syncStatus: null, syncError: null, selectedIndustry: 'TESTE', tasks: { CHECKIN: true }, photos: { FACHADA: [stored[0]] }, stockQuantities: {}, aiResults: {}, hasReturns: null, returnsPhotosByIndustry: {}, availableStores: [], industries: ['TESTE'], industryExecutions: executions };
        localStorage.setItem('criativa_session', JSON.stringify({ user, token: 'local-only', issuedAt: new Date().toISOString() }));
        const db = await open('criativa-field-ops', 1, db => db.createObjectStore('visit-drafts'));
        await put(db, 'visit-drafts', [['active-visit', draft]]);
        canvas.width = canvas.height = 1;
        return { storedPhotos: 100, photoBytesBase64: photos[0].length, draftJsonBytes: JSON.stringify(draft).length };
      }, { mode, user });
      await page.addInitScript(() => {
        window.audit = { urls: new Set(), bitmaps: new Set(), decoded: [], failSave: false };
        if (typeof createImageBitmap === 'function') {
          const bitmap = window.createImageBitmap.bind(window), close = ImageBitmap.prototype.close;
          window.createImageBitmap = async (...args) => { const result = await bitmap(...args); window.audit.bitmaps.add(result); return result; };
          ImageBitmap.prototype.close = function () { window.audit.bitmaps.delete(this); return close.call(this); };
        }
        const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
        URL.createObjectURL = value => { const url = create(value); window.audit.urls.add(url); return url; };
        URL.revokeObjectURL = url => { window.audit.urls.delete(url); return revoke(url); };
        const draw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
          if (image instanceof HTMLImageElement) window.audit.decoded.push({ width: image.naturalWidth, height: image.naturalHeight, canvasWidth: this.canvas.width, canvasHeight: this.canvas.height });
          if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) window.audit.decoded.push({ width: image.width, height: image.height, canvasWidth: this.canvas.width, canvasHeight: this.canvas.height, bitmap: true });
          return draw.call(this, image, ...args);
        };
        const add = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function (...args) {
          if (this.name === 'photos' && window.audit.failSave) throw new DOMException('Falha de armazenamento simulada', 'QuotaExceededError');
          return add.apply(this, args);
        };
      });
      await page.goto(origin);
      await page.locator('input[type=file]').first().waitFor();
      const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
      const sample = async stage => {
        await cdp.send('HeapProfiler.collectGarbage');
        const { metrics } = await cdp.send('Performance.getMetrics');
        return { stage, jsHeapBytes: metrics.find(x => x.name === 'JSHeapUsedSize').value, domNodes: metrics.find(x => x.name === 'Nodes').value };
      };
      const memory = [await sample('100-photos-before-camera')];
      // Generate inputs in a separate page so generator canvases do not pollute app metrics.
      const generator = await context.newPage(); await generator.goto(origin + '/fixture');
      const sources = [];
      for (const [width, height] of [[4000, 3000], [8000, 6000]]) {
        const data = await generator.evaluate(async ({ width, height }) => {
          const c = document.createElement('canvas'); c.width = width; c.height = height;
          const x = c.getContext('2d'); x.fillStyle = '#687c62'; x.fillRect(0, 0, width, height);
          x.font = '80px Arial'; x.fillStyle = 'white'; x.fillText('TESTE ISOLADO DE CAPTURA', 100, 150);
          const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.9));
          const binary = new Uint8Array(await blob.arrayBuffer()); let text = '';
          for (let i = 0; i < binary.length; i += 32768) text += String.fromCharCode(...binary.subarray(i, i + 32768));
          c.width = c.height = 1; return btoa(text);
        }, { width, height });
        sources.push({ width, height, buffer: Buffer.from(data, 'base64') });
      }
      const exif = Buffer.alloc(36); exif[0] = 255; exif[1] = 225; exif.writeUInt16BE(34, 2); exif.write('Exif\0\0', 4, 'binary');
      exif.write('II', 10); exif.writeUInt16LE(42, 12); exif.writeUInt32LE(8, 14); exif.writeUInt16LE(1, 18);
      exif.writeUInt16LE(0x112, 20); exif.writeUInt16LE(3, 22); exif.writeUInt32LE(1, 24); exif.writeUInt16LE(6, 28);
      sources.push({ ...sources[0], buffer: Buffer.concat([sources[0].buffer.subarray(0, 2), exif, sources[0].buffer.subarray(2)]), exifOrientation: 6 });
      await generator.close(); await page.bringToFront();
      const count = () => page.evaluate(() => new Promise((resolve, reject) => {
        const r = indexedDB.open('criativa-field-ops', 1); r.onerror = () => reject(r.error);
        r.onsuccess = () => { const db = r.result; const tx = db.transaction('visit-drafts'); const q = tx.objectStore('visit-drafts').get('active-visit'); tx.oncomplete = () => { db.close(); resolve(q.result.industryExecutions.TESTE.photos.DEPOIS.length); }; };
      }));
      const captures = [];
      for (let i = 0; i < 8; i++) {
        const source = sources[i === 7 ? 1 : i === 6 ? 2 : 0]; const start = Date.now();
        await page.waitForFunction(() => document.querySelector('input[type=file]')?.disabled === false);
        assert.equal(await count(), 5 + i, `Contagem antes da captura ${i}`);
        await page.locator('input[type=file]').first().setInputFiles({ name: `audit-${i}.jpg`, mimeType: 'image/jpeg', buffer: source.buffer });
        await page.waitForFunction(expected => new Promise(resolve => {
          const r = indexedDB.open('criativa-field-ops', 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction('visit-drafts'); const q = tx.objectStore('visit-drafts').get('active-visit'); tx.oncomplete = () => { db.close(); resolve(q.result.industryExecutions.TESTE.photos.DEPOIS.length === expected); }; };
        }), 6 + i);
        await page.waitForFunction(() => document.querySelector('input[type=file]')?.disabled === false);
        // Wait for the UI and coalesced draft writer to finish, as a person would
        // before opening the native camera again. Never infer ready from text case.
        await page.waitForTimeout(200);
        assert.equal(await count(), 6 + i, `Contagem depois da captura ${i}`);
        captures.push({ width: source.width, height: source.height, exifOrientation: source.exifOrientation, ms: Date.now() - start });
        if (i === 3 || i === 7) memory.push(await sample(`after-${i + 1}-captures`));
      }
      const beforeFailure = await count();
      await page.locator('input[type=file]').first().setInputFiles({ name: 'invalid.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('INVALID JPEG FOR ERROR TEST') });
      await page.waitForFunction(() => document.querySelector('input[type=file]')?.disabled === false);
      assert.equal(await count(), beforeFailure, 'Foto invalida nao pode alterar registros existentes');
      assert.ok(dialogs.some(x => x.includes('processar a foto')));
      if (mode === 'lite') {
        await page.evaluate(() => { window.audit.failSave = true; });
        await page.locator('input[type=file]').first().setInputFiles({ name: 'quota.jpg', mimeType: 'image/jpeg', buffer: sources[0].buffer });
        await page.waitForFunction(() => document.querySelector('input[type=file]')?.disabled === false);
        assert.equal(await count(), beforeFailure, 'Falha de gravacao nao pode contar foto nem apagar anteriores');
        assert.ok(dialogs.some(x => x.includes('armazenamento simulada')));
        await page.evaluate(() => { window.audit.failSave = false; });
      }
      memory.push(await sample('after-handled-failures'));
      const cleanup = await page.evaluate(() => ({ objectUrlsOutstanding: window.audit.urls.size, bitmapsOutstanding: window.audit.bitmaps.size, decodedSources: window.audit.decoded }));
      assert.equal(cleanup.objectUrlsOutstanding, 0);
      assert.equal(cleanup.bitmapsOutstanding, 0);
      assert.ok(cleanup.decodedSources.every(x => x.bitmap && Math.max(x.width, x.height) <= 1664), 'Fotos grandes devem chegar reduzidas ao canvas');
      assert.ok(cleanup.decodedSources.some(x => x.height > x.width), 'Orientacao EXIF deve ser respeitada');
      await page.reload(); await page.locator('input[type=file]').first().waitFor();
      assert.equal(await count(), beforeFailure, 'Recarga deve preservar todas as fotos');
      const loaded = await page.locator('img[alt=Captura]').count();
      assert.ok(loaded <= (mode === 'lite' ? 1 : 6));
      // Exercise photo previews repeatedly; only one page of images may stay mounted.
      for (let cycle = 0; cycle < 25; cycle++) {
        await page.getByRole('button', { name: 'Anteriores' }).click();
        await page.getByRole('button', { name: 'Recentes' }).click();
      }
      memory.push(await sample('after-reload-and-50-gallery-changes'));
      if (mode === 'lite') await auditLiteCamera(page, context, count, beforeFailure, sources[0].buffer);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ mode, fixture, memory, captures, invalidImagePreserved: true, storageFailurePreserved: mode === 'lite' ? true : 'not-injected', reloadPreserved: true, galleryChanges: 50, mountedPhotoPreviews: loaded, cleanup, errors, note: 'Desktop JS heap after GC; excludes native camera/GPU/decoded bitmap memory. Native Android camera not exercised.' }));
    } finally { await context.close(); }
  }
  // A restart without a session must not erase a previous owner's unsent draft.
  for (const mode of ['normal', 'lite']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        assert.equal(url.origin, origin);
        if (url.pathname === '/api/config') return route.fulfill({ json: { industries: ['TESTE'], timestamp: new Date().toISOString() } });
        if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/session') return route.fulfill({ json: { user: { id: 'audit-owner', name: 'AUDITORIA ISOLADA', user: 'audit', role: 'FIELD_OPS' }, token: 'local-only', expiresAt: '2099-01-01T00:00:00Z' } });
        if (url.pathname === '/api/stores') return route.fulfill({ json: [{ id: 'test', name: 'LOJA TESTE' }] });
        if (url.pathname.startsWith('/api/')) throw new Error('API inesperada sem sessao: ' + url.pathname);
        return route.continue();
      });
      await page.goto(origin + '/fixture');
      await page.evaluate(async mode => {
        const user = { id: 'audit-owner', name: 'AUDITORIA ISOLADA', user: 'audit', role: 'FIELD_OPS' };
        if (mode === 'lite') {
          localStorage.setItem('criativa_lite_enabled', 'true');
          await new Promise((resolve, reject) => {
            const r = indexedDB.open('criativa-lite-photos', 2);
            r.onupgradeneeded = () => { r.result.createObjectStore('photos', { keyPath: 'id' }); r.result.createObjectStore('confirmed-visits', { keyPath: 'key' }); };
            r.onsuccess = () => { const db = r.result; const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').put({ id: 'criativa-photo-v1:audit-owner:preserve-me', ownerId: user.id, base64: 'PHOTO-DATA-TO-PRESERVE', context: { visitId: 'VISIT-SESSION-RECOVERY' } }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = tx.onerror = () => reject(tx.error); };
          });
        }
        const photo = mode === 'lite' ? 'criativa-photo-v1:audit-owner:preserve-me' : 'PHOTO-DATA-TO-PRESERVE';
        const draft = { user, draftOwnerId: user.id, visitId: 'VISIT-SESSION-RECOVERY', currentStore: 'LOJA TESTE', currentStoreId: 'test', step: 'DASHBOARD', checkInDone: true, checkInTime: new Date().toISOString(), photos: { FACHADA: [photo] }, tasks: { CHECKIN: true }, industryExecutions: {}, stockQuantities: {}, aiResults: {}, returnsPhotosByIndustry: {}, availableStores: [], industries: ['TESTE'] };
        await new Promise((resolve, reject) => {
          const r = indexedDB.open('criativa-field-ops', 1); r.onupgradeneeded = () => r.result.createObjectStore('visit-drafts');
          r.onsuccess = () => { const db = r.result; const tx = db.transaction('visit-drafts', 'readwrite'); tx.objectStore('visit-drafts').put(draft, 'active-visit'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = tx.onerror = () => reject(tx.error); };
        });
      }, mode);
      await page.goto(origin); await page.getByRole('button', { name: 'Acessar', exact: true }).waitFor();
      await page.waitForTimeout(1000);
      const actual = await page.evaluate(() => new Promise(resolve => {
        const r = indexedDB.open('criativa-field-ops', 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction('visit-drafts'); const q = tx.objectStore('visit-drafts').get('active-visit'); tx.oncomplete = () => { db.close(); resolve({ visitId: q.result?.visitId, ownerId: q.result?.draftOwnerId, photoCount: q.result?.photos?.FACHADA?.length || 0 }); }; };
      }));
      if (mode === 'lite') actual.separatePhotoPreserved = await page.evaluate(() => new Promise(resolve => {
        const r = indexedDB.open('criativa-lite-photos', 2); r.onsuccess = () => { const db = r.result; const tx = db.transaction('photos'); const q = tx.objectStore('photos').get('criativa-photo-v1:audit-owner:preserve-me'); tx.oncomplete = () => { db.close(); resolve(q.result?.base64 === 'PHOTO-DATA-TO-PRESERVE'); }; };
      }));
      const preserved = actual.visitId === 'VISIT-SESSION-RECOVERY' && actual.ownerId === 'audit-owner' && actual.photoCount === 1;
      console.log(JSON.stringify({ scenario: 'restart-without-session', mode, draftPreserved: preserved, actual, severity: preserved ? 'ok' : 'critical', scope: 'isolated synthetic draft; no production data touched' }));
      if (!preserved) process.exitCode = 2;
      if (preserved) {
        await page.getByPlaceholder('Usuário').fill('audit');
        await page.getByPlaceholder('Senha').fill('local-only');
        await page.getByRole('button', { name: 'Acessar', exact: true }).click();
        await page.getByText('AUDITORIA ISOLADA', { exact: false }).first().waitFor();
        await page.getByRole('button', { name: /1. Antes/i }).waitFor();
        console.log(JSON.stringify({ scenario: 'same-owner-login-restores-visit', mode, restored: true }));
        if (mode === 'normal') {
          await page.addInitScript(() => {
            const get = IDBObjectStore.prototype.get;
            IDBObjectStore.prototype.get = function (key) {
              if (key === 'active-visit' && localStorage.getItem('audit-fail-read') === 'true') throw new Error('Leitura bloqueada em teste isolado');
              return get.call(this, key);
            };
          });
          await page.evaluate(() => localStorage.setItem('audit-fail-read', 'true'));
          await page.reload();
          await page.getByText('Não foi possível abrir os registros salvos', { exact: true }).waitFor();
          await page.screenshot({ path: path.join(process.env.LOCALAPPDATA || root, 'CriativaRecovery/hotfix-read-error.png') });
          await page.evaluate(() => localStorage.removeItem('audit-fail-read'));
          await page.reload();
          await page.getByRole('button', { name: /1. Antes/i }).waitFor();
          console.log(JSON.stringify({ scenario: 'failed-draft-read-and-recovery', preserved: true, recovered: true }));
        }
      }
    } finally { await context.close(); }
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

async function auditLiteCamera(page, context, count, initialCount, fallbackFile) {
  const input = page.locator('input[type=file]').first();
  const take = page.getByRole('button', { name: 'Tirar foto', exact: true });
  const cancel = page.getByRole('button', { name: 'Cancelar', exact: true });
  const noActiveTrack = () => page.waitForFunction(() => window.cameraAudit.tracks.every(t => t.readyState === 'ended'));
  const awaitCount = async expected => {
    await assert.doesNotReject(async () => {
      for (let i = 0; i < 100; i++) {
        if (await count() === expected) return;
        await page.waitForTimeout(50);
      }
      assert.equal(await count(), expected);
    });
  };
  await context.grantPermissions(['camera']);
  await page.evaluate(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const audit = window.cameraAudit = { tracks: [], mode: 'ok', calls: 0 };
    navigator.mediaDevices.getUserMedia = async constraints => {
      audit.calls++;
      audit.constraints = constraints;
      if (audit.mode === 'denied') throw new DOMException('denied', 'NotAllowedError');
      const stream = await real(constraints);
      audit.tracks.push(...stream.getTracks());
      if (audit.mode === 'delay') await new Promise(resolve => { audit.grant = resolve; });
      return stream;
    };
  });
  assert.equal(await page.evaluate(() => window.cameraAudit.calls), 0);
  await input.click();
  await take.waitFor();
  await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
  await cancel.click();
  await noActiveTrack();
  assert.equal(await count(), initialCount);
  await page.evaluate(() => { window.cameraAudit.mode = 'delay'; });
  await input.click();
  await page.waitForFunction(() => !!window.cameraAudit.grant);
  await cancel.click();
  await page.evaluate(() => window.cameraAudit.grant());
  await noActiveTrack();
  await page.evaluate(() => { window.cameraAudit.mode = 'ok'; });
  await input.click();
  await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await noActiveTrack();
  assert.equal(await count(), initialCount);
  await context.setOffline(true);
  await input.click();
  await take.click();
  await noActiveTrack();
  await awaitCount(initialCount + 1);
  await context.setOffline(false);
  const constraints = await page.evaluate(() => window.cameraAudit.constraints);
  assert.equal(constraints.audio, false);
  assert.ok(constraints.video.width.max <= 1280 && constraints.video.frameRate.max <= 15);
  await page.evaluate(() => { window.cameraAudit.mode = 'denied'; });
  await input.click();
  await page.getByRole('alert').filter({ hasText: 'câmera leve' }).waitFor();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Usar câmera do aparelho' }).click();
  await (await chooser).setFiles({ name: 'native.jpg', mimeType: 'image/jpeg', buffer: fallbackFile });
  await awaitCount(initialCount + 2);
  await page.reload();
  await input.waitFor();
  assert.equal(await count(), initialCount + 2);
  console.log(JSON.stringify({ camera: 'android-lite-simulated', offlinePhotoSaved: true, fallbackPhotoSaved: true,
    cancelPreservedCount: true, pageHideReleased: true, latePermissionReleased: true, reloadPreserved: true }));
}
