// Public read-only checks. Never signs in or writes a real image/visit.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const origin = process.argv[3], expectedBundle = process.argv[4];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(origin, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
  await page.getByRole('button', { name: 'Acessar', exact: true }).waitFor();
  const bundle = await page.locator('script[src*="/assets/index-"]').getAttribute('src'); assert.ok(bundle.includes(expectedBundle));
  const health = await page.request.get(origin + '/api/health'); assert.equal(health.status(), 200);
  const status = await health.json(); assert.equal(status.integrations.syncProvider, 'google-v1');
  const anonymous = await page.request.post(origin + '/api/photos/recovery', { data: { action: 'read', photoId: 'criativa-photo-v1:101:12345678-1234-4234-8234-123456789012' } });
  assert.equal(anonymous.status(), 401); assert.equal(anonymous.headers()['cache-control'], 'no-store');
  const invalidMethod = await page.request.get(origin + '/api/photos/recovery'); assert.equal(invalidMethod.status(), 405);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ origin, login: 200, health: 200, syncProvider: status.integrations.syncProvider, bundle, anonymousRecovery: 401, getMethod: 405, errors, realLogin: false, realImagesWritten: false }));
} finally { await browser.close(); }
