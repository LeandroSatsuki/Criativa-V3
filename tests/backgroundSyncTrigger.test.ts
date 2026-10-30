import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldStartBackgroundSync } from '../netlify/functions/_shared/background-sync-trigger.ts';

test('ativa disparo atomico somente para cliente compativel', () => {
  const compatible = new Request('https://example.test/api/visits', {
    headers: { 'X-Criativa-Start-Sync': 'background' },
  });
  const legacy = new Request('https://example.test/api/visits');

  assert.equal(shouldStartBackgroundSync(compatible), true);
  assert.equal(shouldStartBackgroundSync(legacy), false);
});
