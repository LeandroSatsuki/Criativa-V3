import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { getAppData } from './_shared/data';
import { listVisitSummaries } from './_shared/visits';
import { buildSupervisorDashboard } from './_shared/supervisor';
import { getSupervisorAccessError } from './_shared/supervisor-access';
import {
  readSupervisorDashboardCache,
  writeSupervisorDashboardCache,
} from './_shared/supervisor-dashboard-cache';
import type { SupervisorDashboardResponse } from '../../src/types';
import { resolveSupervisorDate } from './_shared/supervisor-date.ts';

const dashboardBuilds = new Map<string, Promise<SupervisorDashboardResponse>>();

const loadDashboard = async (date: string, selected: Date) => {
  try {
    const cached = await readSupervisorDashboardCache(date);
    if (cached) return cached;
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'supervisor_dashboard_cache_read_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
  }

  if (!dashboardBuilds.has(date)) {
    const build = (async () => {
      const [data, visits] = await Promise.all([getAppData(), listVisitSummaries()]);
      const dashboard = buildSupervisorDashboard(data, visits, new Date(), selected);
      try {
        await writeSupervisorDashboardCache(date, dashboard);
      } catch (error) {
        console.warn(JSON.stringify({
          event: 'supervisor_dashboard_cache_write_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }));
      }
      return dashboard;
    })().finally(() => {
      dashboardBuilds.delete(date);
    });
    dashboardBuilds.set(date, build);
  }

  return dashboardBuilds.get(date);
};

export default async (request: Request, _context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
  const accessError = getSupervisorAccessError(auth);
  if (accessError) {
    return json({ error: accessError.message }, accessError.status);
  }

  const selection = resolveSupervisorDate(new URL(request.url).searchParams.get('date'));
  if (!selection) return json({ error: 'Data de consulta inválida.' }, 400);

  return json(await loadDashboard(selection.date, selection.selected));
};

export const config: Config = {
  path: '/api/supervisor/dashboard',
};
