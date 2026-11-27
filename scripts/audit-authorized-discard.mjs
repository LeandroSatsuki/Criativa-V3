// Synthetic local session only. No production login, data or network access.
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
const user = { id: '101', name: 'TESTE ISOLADO', user: 'lorena.costa', role: 'FIELD_OPS' }, oldId = 'VISIT-9ADC2CA2';
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); assert.equal(url.origin, origin, 'Sem conexoes externas');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data;
    if (url.pathname === '/api/config') data = { industries: ['TESTE'], timestamp: new Date().toISOString() };
    else if (url.pathname === '/api/stores') data = [{ id: 'new-store', name: 'LOJA NOVA' }];
    else if (url.pathname === '/api/auth/session') data = { user, token: 'local-only', expiresAt: '2099-01-01T00:00:00Z' };
    else if (url.pathname.startsWith('/api/sync/')) return route.fulfill({ status: 404, json: { error: 'not found' } });
    else throw new Error('Nao deve enviar visitas neste ensaio: ' + url.pathname);
    await route.fulfill({ json: data });
  });
  await page.goto(origin + '/fixture');
  await page.evaluate(async ({ user, oldId }) => {
    localStorage.setItem('criativa_session', JSON.stringify({ user, token: 'local-only', issuedAt: new Date().toISOString() }));
    const open = (name, version, upgrade) => new Promise((resolve, reject) => { const r = indexedDB.open(name, version); r.onupgradeneeded = () => upgrade(r.result); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const put = (db, store, entries) => new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); for (const [key, value] of entries) key === null ? tx.objectStore(store).put(value) : tx.objectStore(store).put(value, key); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = tx.onerror = () => reject(tx.error); });
    const base = { user, draftOwnerId: user.id, visitId: oldId, currentStore: 'BH PRAIA DA COSTA 539', currentStoreId: 'old-store', step: 'CHECKOUT', checkInDone: true, checkInTime: '2026-11-17T11:00:00Z', checkOutTime: '2026-11-17T15:00:00Z', tasks: { CHECKIN: true, CHECKOUT: true }, photos: { FACHADA: ['old-entry'], CHECKOUT: ['old-exit'] }, industryExecutions: {}, returnsPhotosByIndustry: {}, stockQuantities: {}, aiResults: {}, selectedIndustry: null, availableStores: [], industries: ['TESTE'] };
    const active = { ...base, visitId: 'VISIT-NEW-ACTIVE', currentStore: 'LOJA NOVA', currentStoreId: 'new-store', step: 'DASHBOARD', checkInTime: new Date().toISOString(), checkOutTime: null, photos: { FACHADA: ['new-entry-preserved'] }, tasks: { CHECKIN: true } };
    const queue = await open('criativa-field-ops-sync', 1, db => db.createObjectStore('queued-visits', { keyPath: 'visitId' }));
    const entry = (visitId, payload) => ({ ownerId: user.id, visitId, payload, status: 'error', error: 'Foto local indisponivel. A visita foi preservada para recuperacao.', attempts: 1, createdAt: '2026-11-17T15:00:00Z', updatedAt: '2026-11-17T15:00:00Z' });
    await put(queue, 'queued-visits', [[null, entry(oldId, base)], [null, entry('VISIT-NEW-PENDING', { ...base, visitId: 'VISIT-NEW-PENDING', currentStore: 'NOVA PENDENCIA', photos: { CHECKOUT: ['new-queue-preserved'] } })]]);
    const db = await open('criativa-field-ops', 1, db => db.createObjectStore('visit-drafts')); await put(db, 'visit-drafts', [['active-visit', active]]);
  }, { user, oldId });
  const state = () => page.evaluate(async oldId => {
    const get = (name, store, key) => new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => { const db = r.result; const tx = db.transaction(store); const q = tx.objectStore(store).get(key); tx.oncomplete = () => { db.close(); resolve(q.result || null); }; tx.onabort = tx.onerror = () => reject(tx.error); }; });
    const old = await get('criativa-field-ops-sync', 'queued-visits', oldId), next = await get('criativa-field-ops-sync', 'queued-visits', 'VISIT-NEW-PENDING'), active = await get('criativa-field-ops', 'visit-drafts', 'active-visit'), backup = await get('criativa-field-ops', 'visit-drafts', `abandoned-queue:101:${oldId}`);
    return { oldPresent: !!old, nextPhoto: next?.payload.photos.CHECKOUT[0], activeId: active?.visitId, activePhoto: active?.photos?.FACHADA?.[0], backupId: backup?.queued?.visitId };
  }, oldId);
  await page.goto(origin); await page.getByRole('button', { name: 'Continuar trabalhando', exact: true }).click();
  await page.getByRole('button', { name: /Status dos envios:/ }).click();
  const remove = page.getByRole('button', { name: 'Remover envio antigo autorizado', exact: true }); await remove.waitFor();
  let dialogText;
  page.once('dialog', async dialog => { dialogText = dialog.message(); await dialog.dismiss(); }); await remove.click();
  assert.match(dialogText, /VISIT-9ADC2CA2/); assert.equal((await state()).oldPresent, true);
  page.once('dialog', async dialog => { await dialog.accept(); }); await remove.click();
  await page.getByText('Somente o envio antigo foi removido.', { exact: false }).waitFor();
  const after = await state();
  assert.deepEqual(after, { oldPresent: false, nextPhoto: 'new-queue-preserved', activeId: 'VISIT-NEW-ACTIVE', activePhoto: 'new-entry-preserved', backupId: oldId });
  await page.screenshot({ path: path.join(process.env.LOCALAPPDATA, 'CriativaRecovery/authorized-discard.png') });
  // An older saved screen must not recreate the abandoned queue on next launch.
  await page.evaluate(oldId => new Promise(resolve => { const r = indexedDB.open('criativa-field-ops', 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction('visit-drafts', 'readwrite'); const store = tx.objectStore('visit-drafts'); const q = store.get(`abandoned-queue:101:${oldId}`); q.onsuccess = () => store.put(q.result.queued.payload, 'active-visit'); tx.oncomplete = () => { db.close(); resolve(); }; }; }), oldId);
  await page.reload(); await page.getByRole('button', { name: 'Continuar trabalhando', exact: true }).click();
  await page.getByRole('button', { name: /Selecionar\s*Loja/ }).waitFor();
  const restored = await state(); assert.equal(restored.oldPresent, false); assert.equal(restored.activeId, null); assert.equal(restored.nextPhoto, 'new-queue-preserved');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ cancelPreservesOld: true, removesOnlyAuthorizedVisit: true, newQueueAndActiveDraftPreserved: true, backupPreserved: true, reloadDoesNotRecreateOldQueue: true, errors, realRequests: false }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
