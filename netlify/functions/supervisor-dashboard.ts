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

let dashboardBuild: Promise<SupervisorDashboardResponse> | null = null;

const loadDashboard = async () => {
  try {
    const cached = await readSupervisorDashboardCache();
    if (cached) return cached;
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'supervisor_dashboard_cache_read_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
  }

  if (!dashboardBuild) {
    dashboardBuild = (async () => {
      const [data, visits] = await Promise.all([getAppData(), listVisitSummaries()]);
      const dashboard = buildSupervisorDashboard(data, visits);
      try {
        await writeSupervisorDashboardCache(dashboard);
      } catch (error) {
        console.warn(JSON.stringify({
          event: 'supervisor_dashboard_cache_write_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }));
      }
      return dashboard;
    })().finally(() => {
      dashboardBuild = null;
    });
  }

  return dashboardBuild;
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

  return json(await loadDashboard());
};

export const config: Config = {
  path: '/api/supervisor/dashboard',
};
