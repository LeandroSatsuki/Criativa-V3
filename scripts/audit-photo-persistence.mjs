// Read-only runtime audit using synthetic data on a local Vite server.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } }); await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`, browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ serviceWorkers: 'block' }); page.setDefaultTimeout(10000);
  const user = { id: 'photo-persistence-audit', user: 'audit-local', name: 'AUDITORIA ISOLADA', role: 'FIELD_OPS' };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); assert.equal(url.origin, origin);
    if (url.pathname === '/audit-fixture') return route.fulfill({ contentType: 'text/html', body: '<html></html>' });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data;
    if (url.pathname === '/api/config') data = { industries: ['TESTE'], timestamp: new Date().toISOString() };
    else if (url.pathname === '/api/stores') data = [{ id: 'test-store', name: 'LOJA TESTE' }];
    else if (['/api/auth/login', '/api/auth/session'].includes(url.pathname)) data = { user, token: 'isolated-only', expiresAt: '2099-01-01T00:00:00Z' };
    else throw new Error('API inesperada: ' + url.pathname);
    await route.fulfill({ json: data });
  });
  await page.addInitScript(() => {
    window.persistenceRequests = 0;
    Object.defineProperty(navigator.storage, 'persist', { configurable: true, value: async () => { window.persistenceRequests++; return false; } });
  });
  await page.goto(origin); await page.getByRole('button', { name: 'Acessar', exact: true }).waitFor();
  await page.getByPlaceholder('Usuário').fill(user.user); await page.getByPlaceholder('Senha').fill('synthetic-only');
  await page.getByRole('button', { name: 'Acessar', exact: true }).click();
  await page.getByText('AUDITORIA ISOLADA', { exact: false }).first().waitFor();
  const afterLogin = await page.evaluate(() => window.persistenceRequests);
  await page.reload(); await page.getByText('AUDITORIA ISOLADA', { exact: false }).first().waitFor();
  const afterReload = await page.evaluate(() => window.persistenceRequests);
  assert.equal(afterLogin, 1, 'Primeiro login solicita persistencia sem bloquear com permissao negada');
  assert.equal(afterReload, 1, 'Abertura autenticada solicita persistencia uma vez');
  console.log(JSON.stringify({ scenario: 'persistence-request', afterFirstLogin: afterLogin, afterAuthenticatedReload: afterReload, permissionSimulated: true, realRequests: false }));
  await page.goto(origin + '/audit-fixture');
  const findings = await page.evaluate(async () => {
    const { generateVisitId } = await import('/src/services/visitId.ts');
    const original = crypto.randomUUID.bind(crypto);
    let counter = 0;
    crypto.randomUUID = () => counter++ ? '12345678-2222-4222-8222-222222222222' : '12345678-1111-4111-8111-111111111111';
    const firstId = generateVisitId(), secondId = generateVisitId(); crypto.randomUUID = original;
    const { storeLocalPhoto, readLocalPhoto, pruneConfirmedPhotos } = await import('/src/services/litePhotos.ts');
    const { saveVisitDraft } = await import('/src/services/visitStorage.ts');
    const { upsertQueuedVisit, removeQueuedVisit } = await import('/src/services/syncQueue.ts');
    const txOriginal = IDBDatabase.prototype.transaction, writes = [];
    IDBDatabase.prototype.transaction = function (...args) { const tx = txOriginal.apply(this, args); if (args[1] === 'readwrite') writes.push({ db: this.name, durability: tx.durability, requested: args[2]?.durability || 'not-specified' }); return tx; };
    try {
      const owner = 'photo-risk-audit', visitId = 'VISIT-PHOTO-RISK';
      const photo = i => btoa(`photo-${i}:` + 'A'.repeat(75000));
      const refs = [], captureStart = performance.now();
      for (let i = 0; i < 27; i++) refs.push(await storeLocalPhoto(owner, photo(i), { visitId, storeId: 'store', section: 'ANTES', industry: 'TESTE', capturedAt: new Date().toISOString() }));
      const photoWriteAndReadMs = performance.now() - captureStart;
      const draft = { user: { id: owner }, draftOwnerId: owner, visitId, checkInDone: true, photos: { FACHADA: [refs[0]] }, industryExecutions: { TESTE: { photos: { ANTES: refs.slice(1) } } }, tasks: { CHECKIN: true }, step: 'ANTES' };
      await saveVisitDraft('risk-audit', draft); await upsertQueuedVisit(owner, draft, visitId);
      const afterWeeks = await pruneConfirmedPhotos(owner, Date.now() + 30 * 86400000);
      await removeQueuedVisit(owner, visitId);
      const draftGuard = await pruneConfirmedPhotos(owner, Date.now() + 30 * 86400000);
      await saveVisitDraft('risk-audit', { ...draft, visitId: null, checkInDone: false, photos: {}, industryExecutions: {}, tasks: {} });
      const unconfirmedGuard = await pruneConfirmedPhotos(owner, Date.now() + 30 * 86400000);
      let readable = 0;
      for (let i = 0; i < refs.length; i++) if (await readLocalPhoto(owner, refs[i]) === photo(i)) readable++;
      return { idCollisionDemonstrated: firstId === secondId, firstId, secondId, pendingQueueDeletedPhotos: afterWeeks, activeDraftDeletedPhotos: draftGuard, unconfirmedDeletedPhotos: unconfirmedGuard, readable, photoWriteAndReadMs, writes: [...new Map(writes.map(row => [JSON.stringify(row), row])).values()] };
    } finally { IDBDatabase.prototype.transaction = txOriginal; }
  });
  assert.equal(findings.readable, 27); assert.equal(findings.pendingQueueDeletedPhotos, 0); assert.equal(findings.activeDraftDeletedPhotos, 0); assert.equal(findings.unconfirmedDeletedPhotos, 0);
  for (const db of ['criativa-lite-photos', 'criativa-field-ops', 'criativa-field-ops-sync']) assert.ok(findings.writes.some(row => row.db === db && row.durability === 'strict' && row.requested === 'strict'));
  console.log(JSON.stringify({ ...findings, note: 'Synthetic collision demonstrates truncated-ID weakness, not a proven collision in Lorena. Default durability is not a measured power-loss test.' }));
} finally { await browser.close(); await server.close(); }
