// Isolated reproduction: 15 existing photos, 17 unavailable references. No real account/network.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { pathToFileURL } from 'node:url';
import { createPhotoRecoveryHandler } from '../netlify/functions/_shared/photo-recovery.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } }); await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const copies = new Map(), diagnostics = new Map();
const store = map => ({ get: async key => map.get(key) || null, set: async (key, value) => { map.set(key, structuredClone(value)); }, list: async prefix => [...map.keys()].filter(key => key.startsWith(prefix)) });
const handler = createPhotoRecoveryHandler({ authenticate: async req => req.headers.get('authorization') === 'Bearer local-only' ? { sub: '101', role: 'FIELD_OPS' } : null, photos: store(copies), diagnostics: store(diagnostics) });
let active = 0, maxActive = 0;
try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); assert.equal(url.origin, origin, 'No external traffic');
    if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: '<html></html>' });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname.startsWith('/api/sync/')) return route.fulfill({ status: 404, json: { error: 'not found' } });
    const user = { id: '101', user: 'lorena.costa', name: 'TESTE ISOLADO', role: 'FIELD_OPS' };
    if (url.pathname === '/api/config') return route.fulfill({ json: { industries: ['TESTE'], timestamp: new Date().toISOString() } });
    if (url.pathname === '/api/stores') return route.fulfill({ json: [{ id: 'isolated', name: 'LOJA TESTE ISOLADA' }] });
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user, token: 'local-only', expiresAt: '2099-01-01T00:00:00Z' } });
    assert.equal(url.pathname, '/api/photos/recovery'); active++; maxActive = Math.max(maxActive, active);
    if (route.request().postDataJSON()?.visitId === 'VISIT-AUX-AUTH-REJECT') { active--; return route.fulfill({ status: 401, json: { error: 'Synthetic auxiliary rejection' } }); }
    try { const response = await handler(new Request(url, { method: 'POST', body: route.request().postData(), headers: route.request().headers() })); await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() }); }
    finally { active--; }
  });
  await page.goto(origin + '/fixture');
  const result = await page.evaluate(async () => {
    localStorage.setItem('criativa_session', JSON.stringify({ token: 'local-only', user: { id: '101', user: 'lorena.costa', role: 'FIELD_OPS' }, expiresAt: '2099-01-01T00:00:00Z' }));
    const { storeLocalPhoto, readLocalPhoto } = await import('/src/services/litePhotos.ts');
    const { protectVisitPhotos } = await import('/src/services/photoSafety.ts');
    const { protectPhotoCopy, recoverPhotoCopy } = await import('/src/services/photoRecoveryClient.ts');
    const { restorePhotoFromGallery } = await import('/src/services/restorePhotoFromGallery.ts');
    const { auditLocalVisitPhotos } = await import('/src/services/localPhotoAudit.ts');
    const { upsertQueuedVisit, getQueuedVisit } = await import('/src/services/syncQueue.ts');
    const { sendLiteVisit } = await import('/src/services/liteUpload.ts');
    const canvas = document.createElement('canvas'); canvas.width = 624; canvas.height = 832;
    const context = canvas.getContext('2d'), pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 123;
    for (let i = 0; i < pixels.data.length; i += 4) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; pixels.data[i] = seed & 255; pixels.data[i + 1] = seed >>> 8 & 255; pixels.data[i + 2] = seed >>> 16 & 255; pixels.data[i + 3] = 255; }
    context.putImageData(pixels, 0, 0);
    const { compressStampedPhoto } = await import('/src/services/imageCompression.ts');
    const compressed = await compressStampedPhoto(canvas), photo = compressed.base64;
    if (compressed.bytes < 50000 || compressed.bytes > 122880) throw new Error('Unrepresentative photo fixture');
    canvas.width = canvas.height = 1;
    const refs = [];
    for (let i = 0; i < 15; i++) refs.push(await storeLocalPhoto('101', photo, { visitId: 'VISIT-RECOVERY', storeId: 'isolated', section: 'ANTES', industry: 'TESTE', capturedAt: new Date().toISOString() }));
    for (let i = 0; i < 17; i++) refs.push(`criativa-photo-v1:101:${crypto.randomUUID()}`);
    const payload = { user: { id: '101' }, visitId: 'VISIT-RECOVERY', photos: { ANTES: refs } };
    await upsertQueuedVisit('101', payload, payload.visitId, 'error');
    const { setPhotoCaptureBusy } = await import('/src/services/liteMode.ts');
    setPhotoCaptureBusy(true);
    const paused = await protectVisitPhotos('101', payload.visitId, payload, true);
    setPhotoCaptureBusy(false);
    if (paused.protected !== 0 || paused.remaining !== 32) throw new Error('Backup did not pause for capture');
    const protection = await protectVisitPhotos('101', payload.visitId, payload, true);
    const preserved = await getQueuedVisit('101', payload.visitId);
    // Simulate loss of the primary local records after verified server backup.
    await new Promise((resolve, reject) => { const r = indexedDB.open('criativa-lite-photos', 2); r.onsuccess = () => { const db = r.result, tx = db.transaction('photos', 'readwrite'); for (const id of refs.slice(0, 15)) tx.objectStore('photos').delete(id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = tx.onerror = () => reject(tx.error); }; });
    const audit = await auditLocalVisitPhotos('101', payload, () => '101');
    const localRestored = await new Promise(resolve => { const r = indexedDB.open('criativa-lite-photos', 2); r.onsuccess = () => { const db = r.result, tx = db.transaction('photos'), q = tx.objectStore('photos').count(); tx.oncomplete = () => { db.close(); resolve(q.result); }; }; });
    const parallel = await Promise.all([protectVisitPhotos('101', 'VISIT-FIRST', { photos: [refs[0]] }, true), protectVisitPhotos('101', 'VISIT-SECOND', { photos: [refs[1], refs[2]] }, true)]);
    if (parallel[0].protected !== 1 || parallel[1].protected !== 2) throw new Error('Mixed protection reports');
    let sent = 0, failed = false;
    try { await sendLiteVisit(payload, ref => readLocalPhoto('101', ref), async () => { sent++; }); } catch { failed = true; }
    // Simulated originals supplied separately, never fabricated in the application.
    const original = new File([Uint8Array.from(atob(photo), c => c.charCodeAt(0))], 'original.jpg', { type: 'image/jpeg' });
    let noOverwrite = false; try { await restorePhotoFromGallery('101', payload.visitId, refs[0], original); } catch { noOverwrite = true; }
    if (!noOverwrite) throw new Error('Readable original was replaced');
    for (const id of refs.slice(15)) await restorePhotoFromGallery('101', payload.visitId, id, original);
    const chunks = []; let finalized = false;
    await sendLiteVisit(payload, ref => readLocalPhoto('101', ref), async body => {
      if (body.action === 'status') return { receivedIndexes: [] };
      if (body.action === 'chunk') { chunks[body.index] = body.chunk; return {}; }
      const reconstructed = JSON.parse(chunks.join('')); if (reconstructed.photos.ANTES.length !== 32) throw new Error('Photo count mismatch'); finalized = true; return { visitId: payload.visitId };
    });
    const previousSession = localStorage.getItem('criativa_session'); let rejected = false;
    try { await protectPhotoCopy('101', refs[0], 'VISIT-AUX-AUTH-REJECT', photo); } catch { rejected = true; }
    if (!rejected || localStorage.getItem('criativa_session') !== previousSession) throw new Error('Auxiliary failure changed operational session');
    localStorage.setItem('criativa_session', JSON.stringify({ token: 'other-only', user: { id: 'other' } }));
    let ownerGuard = false; try { await recoverPhotoCopy('101', refs[0]); } catch { ownerGuard = true; }
    // A changed session returns no copy and makes no authenticated recovery call.
    ownerGuard = ownerGuard || await recoverPhotoCopy('101', refs[0]) === null;
    return { protection, queuePhotoCount: preserved.payload.photos.ANTES.length, auditAfterPrimaryLoss: audit, localRestored, separateConcurrentReports: true, auxiliary401PreservesSession: true, incompleteVisitBlocked: failed && sent === 0, all32RestoredFromSuppliedCopies: finalized, ownerGuard, queueStillPreserved: Boolean(await getQueuedVisit('101', payload.visitId)) };
  });
  assert.deepEqual(result.protection, { protected: 15, missing: 17, failed: 0, remaining: 0 });
  assert.equal(result.queuePhotoCount, 32); assert.equal(result.auditAfterPrimaryLoss.readable, 15); assert.equal(result.auditAfterPrimaryLoss.missing, 17);
  assert.equal(result.incompleteVisitBlocked, true); assert.equal(result.all32RestoredFromSuppliedCopies, true); assert.equal(result.ownerGuard, true); assert.equal(result.queueStillPreserved, true);
  assert.equal(result.localRestored, 15); assert.equal(copies.size, 32); assert.equal(diagnostics.size, 4); assert.equal(maxActive, 1);
  console.log(JSON.stringify({ ...result, privateCopies: copies.size, diagnosticReports: diagnostics.size, simultaneousRequests: maxActive, realUserData: false }));
  // Real React controls with synthetic session, cancellation and gallery restore.
  await page.goto(origin + '/fixture');
  const uiPhoto = await page.evaluate(async () => {
    const user = { id: '101', user: 'lorena.costa', name: 'TESTE ISOLADO', role: 'FIELD_OPS' };
    localStorage.setItem('criativa_session', JSON.stringify({ token: 'local-only', user, expiresAt: '2099-01-01T00:00:00Z' }));
    localStorage.setItem('criativa_lite_enabled', 'true');
    const { storeLocalPhoto } = await import('/src/services/litePhotos.ts');
    const { removeQueuedVisit, upsertQueuedVisit, updateQueuedVisit } = await import('/src/services/syncQueue.ts');
    await removeQueuedVisit('101', 'VISIT-RECOVERY');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
    const photo = canvas.toDataURL('image/jpeg').split(',')[1]; canvas.width = canvas.height = 1;
    const good = await storeLocalPhoto('101', photo), missing = `criativa-photo-v1:101:${crypto.randomUUID()}`;
    await upsertQueuedVisit('101', { user, visitId: 'VISIT-UI-RECOVERY', currentStore: 'LOJA TESTE ISOLADA', photos: { FACHADA: [good], CHECKOUT: [missing] } }, 'VISIT-UI-RECOVERY', 'error');
    await updateQueuedVisit('101', 'VISIT-UI-RECOVERY', { error: 'Foto local indisponivel. A visita foi preservada para recuperacao.' });
    return photo;
  });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Continuar trabalhando', exact: true }).click();
  await page.getByRole('button', { name: /Status dos envios:/ }).click();
  await page.getByRole('button', { name: 'Verificar fotos salvas', exact: true }).click();
  await page.getByRole('button', { name: 'Proteger fotos disponiveis', exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes('Fotos nao encontradas: 1'));
  await page.getByRole('button', { name: 'Recuperar originais da galeria', exact: true }).click();
  const input = page.getByLabel('Restaurar CHECKOUT foto 1'); await input.waitFor();
  const selectFile = () => input.evaluate((element, photo) => { const file = new File([Uint8Array.from(atob(photo), c => c.charCodeAt(0))], 'original.jpg', { type: 'image/jpeg' }), transfer = new DataTransfer(); transfer.items.add(file); element.files = transfer.files; element.dispatchEvent(new Event('change', { bubbles: true })); }, uiPhoto);
  page.once('dialog', dialog => dialog.dismiss()); await selectFile();
  assert.equal(await input.count(), 1);
  page.once('dialog', dialog => dialog.accept()); await selectFile();
  await page.getByText('Todos os originais foram recuperados.', { exact: false }).waitFor();
  await page.waitForFunction(() => document.body.textContent.includes('Fotos com dados acessiveis: 2') || document.body.textContent.includes('Fotos com dados acessíveis: 2'));
  assert.equal(await input.count(), 0); assert.deepEqual(errors, []);
  await page.screenshot({ path: process.env.LOCALAPPDATA + '/CriativaRecovery/photo-recovery-ui.png' });
  console.log(JSON.stringify({ ui: '390px', cancellationPreservesMissingSlot: true, galleryRestoreUpdatesAudit: true, queueNotDeleted: true, errors, realUserData: false }));
} finally { await browser.close(); await server.close(); }
