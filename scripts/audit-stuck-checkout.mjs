// Production build, synthetic phone data, mocked APIs and no external traffic.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root = path.resolve('dist');
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/fixture') { res.setHeader('Content-Type', 'text/html'); res.end('<html></html>'); return; }
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const scenario of ['manual-pending-offline', 'lite-syncing-interrupted', 'already-sent', 'queue-commit-fails', 'new-checkout', 'automatic-reconnect']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    try {
      const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(10000);
      const user = { id: 'stuck-audit', name: 'AUDITORIA ISOLADA', user: 'audit', role: 'FIELD_OPS' }, id = 'VISIT-STUCK-AUDIT';
      let available = scenario === 'already-sent' || scenario === 'automatic-reconnect', remote = scenario === 'already-sent' ? 'enviado' : null, finalized = 0, postedIds = new Set();
      const chunks = new Map();
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url()); assert.equal(url.origin, origin, 'Sem conexoes externas');
        if (!url.pathname.startsWith('/api/')) return route.continue();
        let data;
        if (url.pathname === '/api/config') data = { industries: ['TESTE'], timestamp: new Date().toISOString() };
        else if (url.pathname === '/api/stores') data = [{ id: 'test', name: 'LOJA DE AUDITORIA' }, { id: 'next', name: 'PROXIMA LOJA' }];
        else if (url.pathname === '/api/auth/session') data = { user, token: 'local', expiresAt: '2099-01-01T00:00:00Z' };
        else if (url.pathname.startsWith('/api/sync/')) {
          assert.equal(url.pathname, `/api/sync/${id}/status`);
          if (!remote) return route.fulfill({ status: 404, json: { error: 'Visita nao encontrada' } });
          data = { syncStatus: remote, progress: { total: 27, sent: remote === 'enviado' ? 27 : 0 } };
        } else if (url.pathname === '/api/visits' || url.pathname === '/api/visits/upload') {
          if (!available) return route.abort('internetdisconnected');
          const body = req.postDataJSON(); postedIds.add(body.visitId);
          if (url.pathname === '/api/visits/upload') {
            if (body.action === 'status') data = { receivedIndexes: [...chunks.keys()] };
            else if (body.action === 'chunk') { chunks.set(body.index, body.chunk); data = {}; }
            else {
              const text = [...chunks.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]).join('');
              assert.equal(createHash('sha256').update(text).digest('hex').slice(0, 32), body.uploadId);
              const received = JSON.parse(text); assert.equal(JSON.stringify(received).includes('criativa-photo-v1:'), false);
              assert.equal(received.photos.CHECKOUT.length, 1); assert.equal(received.industryExecutions.TESTE.photos.ANTES.length, 13);
              finalized++; remote = 'enviando'; data = { visitId: id, syncStarted: true };
            }
          } else { finalized++; remote = 'enviando'; assert.equal(body.industryExecutions.TESTE.photos.ANTES.length, 13); data = { visitId: id, syncStarted: true }; }
        } else throw new Error('API inesperada: ' + url.pathname);
        await route.fulfill({ json: data });
      });
      await page.goto(origin + '/fixture');
      await page.evaluate(async ({ user, id, scenario }) => {
        localStorage.setItem('criativa_session', JSON.stringify({ user, token: 'local', issuedAt: new Date().toISOString() }));
        const lite = scenario.startsWith('lite'); if (lite) localStorage.setItem('criativa_lite_enabled', 'true');
        const open = (name, version, upgrade) => new Promise((resolve, reject) => { const r = indexedDB.open(name, version); r.onupgradeneeded = () => upgrade(r.result); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        const put = (db, store, entries) => new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); for (const [key, value] of entries) key === null ? tx.objectStore(store).put(value) : tx.objectStore(store).put(value, key); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = tx.onerror = () => reject(tx.error); });
        const c = document.createElement('canvas'); c.width = 624; c.height = 832; const x = c.getContext('2d'); x.fillStyle = 'green'; x.fillRect(0, 0, 624, 832);
        const raw = c.toDataURL('image/jpeg').split(',')[1]; c.width = c.height = 1;
        const photos = Array.from({ length: 27 }, (_, i) => raw + btoa(`audit-${i}`));
        const refs = lite ? photos.map((_, i) => `criativa-photo-v1:${user.id}:audit-${i}`) : photos;
        if (lite) { const db = await open('criativa-lite-photos', 2, db => { db.createObjectStore('photos', { keyPath: 'id' }); db.createObjectStore('confirmed-visits', { keyPath: 'key' }); }); await put(db, 'photos', photos.map((base64, i) => [null, { id: refs[i], ownerId: user.id, base64, context: { visitId: id } }])); }
        const draft = { user, draftOwnerId: user.id, visitId: id, currentStore: 'LOJA DE AUDITORIA', currentStoreId: 'test', step: 'CHECKOUT', checkInDone: true, checkInTime: '2026-11-17T11:00:00Z', checkOutTime: '2026-11-17T14:00:00Z', tasks: { CHECKIN: true, CHECKOUT: true }, photos: { FACHADA: [refs[0]], CHECKOUT: [refs[26]] }, stockQuantities: {}, aiResults: {}, selectedIndustry: 'TESTE', returnsPhotosByIndustry: {}, hasReturns: false, availableStores: [], industries: ['TESTE'], industryExecutions: { TESTE: { industry: 'TESTE', status: 'concluido', tasks: { ANTES: true, DEPOIS: true, TROCAS: true }, photos: { ANTES: refs.slice(1, 14), DEPOIS: refs.slice(14, 26) }, hasReturns: false, stockQuantities: {}, aiResults: {} } } };
        if (scenario === 'new-checkout') { draft.checkInTime = new Date().toISOString(); draft.checkOutTime = null; draft.tasks.CHECKOUT = false; }
        const db = await open('criativa-field-ops', 1, db => db.createObjectStore('visit-drafts')); await put(db, 'visit-drafts', [['active-visit', draft]]);
        if (scenario !== 'queue-commit-fails' && scenario !== 'new-checkout') { const queue = await open('criativa-field-ops-sync', 1, db => db.createObjectStore('queued-visits', { keyPath: 'visitId' })); await put(queue, 'queued-visits', [[null, { ownerId: user.id, visitId: id, payload: draft, status: lite ? 'syncing' : 'pending', attempts: 0, error: null, createdAt: '2026-11-17T14:00:00Z', updatedAt: '2026-11-17T14:00:00Z' }]]); }
      }, { user, id, scenario });
      if (scenario === 'queue-commit-fails') await page.addInitScript(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) { const r = put.apply(this, args); if (this.name === 'queued-visits') r.addEventListener('success', () => this.transaction.abort()); return r; };
      });
      const readState = () => page.evaluate(() => new Promise(resolve => {
        const r = indexedDB.open('criativa-field-ops', 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction('visit-drafts'); const q = tx.objectStore('visit-drafts').get('active-visit'); tx.oncomplete = () => { db.close(); resolve({ visitId: q.result?.visitId, checkout: q.result?.photos?.CHECKOUT?.length || 0 }); }; };
      }));
      const readQueue = () => page.evaluate(id => new Promise(resolve => { const r = indexedDB.open('criativa-field-ops-sync'); r.onsuccess = () => { const db = r.result; const tx = db.transaction('queued-visits'); const q = tx.objectStore('queued-visits').get(id); tx.oncomplete = () => { db.close(); resolve(q.result || null); }; }; }), id);
      await page.goto(origin);
      console.log(JSON.stringify({ scenario, stage: 'opened' }));
      if (scenario === 'new-checkout') {
        await page.getByRole('button', { name: 'Registro da Saída', exact: true }).click();
      }
      if (scenario === 'queue-commit-fails') {
        await page.getByText('Não foi possível salvar o encerramento automático.', { exact: false }).waitFor();
        assert.equal((await readState()).visitId, id); assert.equal((await readState()).checkout, 1);
        assert.equal(finalized, 0); console.log(JSON.stringify({ scenario, activeDraftPreserved: true, noUpload: true })); continue;
      }
      const continueButton = page.getByRole('button', { name: 'Continuar trabalhando', exact: true });
      await page.getByText('PROXIMA LOJA', { exact: true }).waitFor();
      if (await continueButton.isVisible()) await continueButton.click();
      console.log(JSON.stringify({ scenario, stage: 'stores-unblocked' }));
      assert.equal((await readState()).visitId, null, 'Rascunho concluido deve liberar a lista');
      if (scenario !== 'already-sent') {
        assert.ok(await readQueue(), 'Fila e fotos devem permanecer apos falha');
        if (scenario === 'automatic-reconnect') {
          await page.getByRole('button', { name: /Status dos envios:/ }).click();
          await page.waitForFunction(() => document.body.textContent.includes('Enviando fotos'));
        } else {
          available = true;
        // Open status and explicitly resume: this must work even when the
        // automatic attempt has just failed and its cooldown is still active.
        await page.getByRole('button', { name: /Status dos envios:/ }).click();
        await page.getByRole('button', { name: 'Enviar visita salva', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Enviar visita salva', exact: true }).click();
        await page.waitForFunction(() => document.body.textContent.includes('Enviando fotos'));
        }
        assert.equal(finalized, 1); assert.deepEqual([...postedIds], [id]); assert.ok(await readQueue());
        remote = 'enviado'; await page.getByRole('button', { name: 'Atualizar status', exact: true }).click();
      } else await page.getByRole('button', { name: /Status dos envios:/ }).click();
      await page.getByText('Nenhum envio pendente', { exact: true }).waitFor();
      assert.equal(await readQueue(), null, 'Remover fila somente depois de enviado');
      if (scenario === 'already-sent') assert.equal(finalized, 0);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ scenario, newStoresUnblocked: true, resumedSameId: true, queueRemovedOnlyAfterConfirmation: true, finalized, errors, realRequests: false }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
