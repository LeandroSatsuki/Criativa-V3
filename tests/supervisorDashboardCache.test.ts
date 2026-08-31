import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getFreshSupervisorDashboard,
  SUPERVISOR_DASHBOARD_CACHE_TTL_MS,
} from '../netlify/functions/_shared/supervisor-dashboard-cache.ts';

const dashboard = {
  summary: {},
  timeline: [],
  promoters: [],
  lastUpdated: '2026-08-31T10:00:00-03:00',
} as any;

test('reutiliza painel somente dentro da validade do cache', () => {
  const now = Date.parse('2026-08-31T14:00:00.000Z');
  assert.equal(getFreshSupervisorDashboard({
    cachedAt: new Date(now - SUPERVISOR_DASHBOARD_CACHE_TTL_MS).toISOString(),
    dashboard,
  }, now), dashboard);
  assert.equal(getFreshSupervisorDashboard({
    cachedAt: new Date(now - SUPERVISOR_DASHBOARD_CACHE_TTL_MS - 1).toISOString(),
    dashboard,
  }, now), null);
});

test('rejeita cache ausente, invalido ou com data futura', () => {
  const now = Date.parse('2026-08-31T14:00:00.000Z');
  assert.equal(getFreshSupervisorDashboard(null, now), null);
  assert.equal(getFreshSupervisorDashboard({ cachedAt: 'invalido', dashboard }, now), null);
  assert.equal(getFreshSupervisorDashboard({
    cachedAt: new Date(now + 1).toISOString(),
    dashboard,
  }, now), null);
});
