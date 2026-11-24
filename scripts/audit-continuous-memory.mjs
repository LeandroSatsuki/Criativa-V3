// Sustained browser use against a local production build. All APIs mocked.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root = path.resolve('dist'), cycles = Number(process.env.AUDIT_CYCLES || 8), capturesPerStage = Number(process.env.AUDIT_PHOTOS || 6);
const output = path.join(process.env.LOCALAPPDATA, 'CriativaRecovery');
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname === '/fixture') { res.setHeader('Content-Type', 'text/html'); res.end('<html></html>'); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const mode of (process.env.AUDIT_MODE ? [process.env.AUDIT_MODE] : ['normal', 'lite'])) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    try {
      console.log(JSON.stringify({ mode, progress: 'starting' }));
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      const errors = [], dialogs = []; page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
      const user = { id: 'continuous-audit', name: 'AUDITORIA LOCAL', user: 'audit', role: 'FIELD_OPS' };
      const received = new Map(), chunks = new Map(); let aiRequests = 0;
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()); assert.equal(url.origin, origin, 'Nenhuma conexao externa');
        if (!url.pathname.startsWith('/api/')) return route.continue();
        let data;
        if (url.pathname === '/api/config') data = { industries: ['TESTE'], timestamp: new Date().toISOString() };
        else if (url.pathname === '/api/stores') data = [{ id: 'store', name: 'LOJA STRESS' }];
        else if (url.pathname === '/api/auth/session') data = { user, token: 'local', expiresAt: '2099-01-01T00:00:00Z' };
        else if (url.pathname === '/api/ai/analyze') {
          aiRequests++;
          data = { organization: 'TESTE', complianceStatus: 'OK', ruptures: '', observations: 'Teste isolado' };
        }
        else if (url.pathname.startsWith('/api/sync/')) {
          const id = url.pathname.split('/')[3];
          if (!received.has(id)) return route.fulfill({ status: 404, json: { error: 'not found' } });
          data = { syncStatus: 'enviado', progress: { total: received.get(id), sent: received.get(id) } };
        } else if (url.pathname === '/api/visits') {
          const body = request.postDataJSON(); received.set(body.visitId, countPhotos(body)); data = { visitId: body.visitId, syncStarted: true };
        } else if (url.pathname === '/api/visits/upload') {
          const body = request.postDataJSON(); const parts = chunks.get(body.uploadId) || new Map(); chunks.set(body.uploadId, parts);
          if (body.action === 'status') data = { receivedIndexes: [...parts.keys()] };
          else if (body.action === 'chunk') { parts.set(body.index, body.chunk); data = {}; }
          else { const bodyText = [...parts.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]).join(''); const payload = JSON.parse(bodyText); received.set(body.visitId, countPhotos(payload)); chunks.delete(body.uploadId); data = { visitId: body.visitId, syncStarted: true }; }
        } else throw new Error('API inesperada: ' + url.pathname);
        await route.fulfill({ json: data });
      });
      function countPhotos(payload) { return (Object.values(payload.photos || {}).flat().length + Object.values(payload.industryExecutions || {}).flatMap(x => Object.values(x.photos || {}).flat()).length); }
      await page.goto(origin + '/fixture');
      const photoFiles = await page.evaluate(async ({ user, mode }) => {
        const c = document.createElement('canvas'); c.width = 1800; c.height = 2400; const ctx = c.getContext('2d');
        const image = ctx.createImageData(1800, 2400); let seed = 183;
        for (let i = 0; i < image.data.length; i += 4) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; image.data[i] = seed & 255; image.data[i + 1] = (seed >>> 8) & 255; image.data[i + 2] = (seed >>> 16) & 255; image.data[i + 3] = 255; }
        ctx.putImageData(image, 0, 0);
        const files = [];
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? 'white' : 'black'; ctx.fillRect(50, 50, 300, 150); ctx.fillStyle = i % 2 ? 'black' : 'white'; ctx.font = '80px Arial'; ctx.fillText(`STRESS ${i}`, 55, 150); files.push(c.toDataURL('image/jpeg', .7).split(',')[1]); }
        c.width = c.height = 1;
        localStorage.setItem('criativa_session', JSON.stringify({ user, token: 'local', issuedAt: new Date().toISOString() }));
        if (mode === 'lite') localStorage.setItem('criativa_lite_enabled', 'true');
        return files;
      }, { user, mode });
      console.log(JSON.stringify({ mode, progress: 'photo-fixtures-ready' }));
      await page.addInitScript(() => {
        window.auditResources = { bitmaps: new Set(), urls: new Set(), databases: new Set(), peakBitmaps: 0 };
        const originalOpen = IDBFactory.prototype.open, originalClose = IDBDatabase.prototype.close;
        IDBFactory.prototype.open = function (...args) { const req = originalOpen.apply(this, args); req.addEventListener('success', () => window.auditResources.databases.add(req.result)); return req; };
        IDBDatabase.prototype.close = function () { window.auditResources.databases.delete(this); return originalClose.call(this); };
        const originalBitmap = window.createImageBitmap.bind(window), originalBitmapClose = ImageBitmap.prototype.close;
        window.createImageBitmap = async (...args) => { const b = await originalBitmap(...args); window.auditResources.bitmaps.add(b); window.auditResources.peakBitmaps = Math.max(window.auditResources.peakBitmaps, window.auditResources.bitmaps.size); return b; };
        ImageBitmap.prototype.close = function () { window.auditResources.bitmaps.delete(this); return originalBitmapClose.call(this); };
        const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
        URL.createObjectURL = source => { const url = create(source); window.auditResources.urls.add(url); return url; };
        URL.revokeObjectURL = url => { window.auditResources.urls.delete(url); return revoke(url); };
      });
      await page.goto(origin);
      console.log(JSON.stringify({ mode, progress: 'app-opened' }));
      const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
      const sample = async (stage, forceGC = true) => {
        // Do not retain evaluated objects in the diagnostic console.
        if (forceGC) await cdp.send('Runtime.discardConsoleEntries');
        if (forceGC) await cdp.send('HeapProfiler.collectGarbage');
        const { metrics } = await cdp.send('Performance.getMetrics'), heap = await cdp.send('Runtime.getHeapUsage');
        const dom = await cdp.send('Memory.getDOMCounters');
        const resource = await page.evaluate(() => ({ bitmaps: window.auditResources.bitmaps.size, objectUrls: window.auditResources.urls.size, databases: window.auditResources.databases.size, peakBitmaps: window.auditResources.peakBitmaps }));
        const row = { mode, stage, jsHeapBytes: heap.usedSize, jsHeapBackingBytes: heap.backingStorageSize, nodes: dom.nodes, listeners: dom.jsEventListeners, ...resource, forceGC };
        console.log(JSON.stringify(row)); return row;
      };
      const click = async name => { const button = page.getByRole('button', { name, exact: typeof name === 'string' }); await button.waitFor(); await button.evaluate(element => element.click()); };
      const capture = async (index, expectedText) => {
        const input = page.locator('input[type=file]').first(); await input.waitFor();
        await page.waitForFunction(() => !document.querySelector('input[type=file]')?.disabled);
        // Avoid Playwright's setInputFiles retaining old native inputs through
        // DevTools handles, which would look like an application memory leak.
        await page.evaluate(base64 => {
          const data = atob(base64), bytes = new Uint8Array(data.length);
          for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
          const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'stress.jpg', { type: 'image/jpeg' }));
          const element = document.querySelector('input[type=file]'); element.files = transfer.files;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }, photoFiles[index % photoFiles.length]);
        await page.waitForFunction(() => !document.querySelector('input[type=file]')?.disabled);
        if (expectedText) await page.getByText(expectedText, { exact: true }).waitFor();
        else await page.waitForFunction(() => [...document.querySelectorAll('img')].some(image => ['Fachada', 'Saída'].includes(image.alt) && image.naturalWidth > 0));
      };
      await click(/Selecionar\s*Loja/);
      console.log(JSON.stringify({ mode, progress: 'initial-stores' }));
      const results = [await sample('empty-before-visits')];
      for (let cycle = 1; cycle <= cycles; cycle++) {
        await click('LOJA STRESS'); await capture(cycle); await click('Confirmar e Iniciar');
        await click(/1\. Antes/); await click('TESTE');
        for (let i = 0; i < capturesPerStage; i++) await capture(cycle + i, `${i + 1}/30 Fotos`);
        await click('Validar e Salvar Registro');
        await click(/3\. Depois/);
        for (let i = 0; i < capturesPerStage; i++) await capture(cycle + i + 2, `${i + 1}/30 Fotos`);
        await click('Validar e Salvar Registro');
        await click(/4\. Trocas/);
        await click('Não'); await click('Salvar e Continuar'); await click(/5\. Finaliza/);
        await capture(cycle + 4); await click('Registro da Saída');
        await page.getByText('LOJA STRESS', { exact: true }).waitFor();
        await click(/Status dos envios:/); await click('Atualizar status');
        await page.getByText('Nenhum envio pendente', { exact: true }).waitFor();
        await click('Fechar status dos envios');
        await page.waitForTimeout(250);
        const natural = await sample(`after-${cycle}-visits-before-GC`, false);
        results.push(await sample(`after-${cycle}-visits`));
        assert.equal(results.at(-1).bitmaps, 0); assert.equal(results.at(-1).objectUrls, 0);
        if (process.env.AUDIT_HEAP_SNAPSHOTS === 'true' && (cycle === 1 || cycle === cycles)) {
          let content = ''; const listener = event => { content += event.chunk; };
          cdp.on('HeapProfiler.addHeapSnapshotChunk', listener);
          await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
          cdp.off('HeapProfiler.addHeapSnapshotChunk', listener);
          await writeFile(path.join(output, `continuous-${mode}-${cycle}.heapsnapshot`), content);
        }
      }
      assert.deepEqual(errors, []); assert.deepEqual(dialogs, []); assert.equal(received.size, cycles);
      console.log(JSON.stringify({ mode, complete: true, visits: cycles, photos: cycles * (capturesPerStage * 2 + 2), firstAfterGc: results[1], lastAfterGc: results.at(-1), aiRequests, errors, dialogs, note: 'Desktop JS heap and browser resources; native Android camera and total device RAM are not measured.' }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
