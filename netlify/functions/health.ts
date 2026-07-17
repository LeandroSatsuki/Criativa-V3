import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { getEnv } from './_shared/env';
import { getProvisionalSupervisorDiagnostics } from './_shared/data';

export default async (_request: Request, _context: Context) => {
  return json({
    ok: true,
    service: 'criativa-field-ops',
    timestamp: new Date().toISOString(),
    integrations: {
      googleSheets: Boolean(getEnv('BACKEND_GOOGLE_SHEETS_ID')),
      make: Boolean(getEnv('BACKEND_MAKE_WEBHOOK_URL')),
      makeV2: Boolean(getEnv('BACKEND_MAKE_WEBHOOK_V2_URL')),
      makeSyncMode: (getEnv('BACKEND_MAKE_SYNC_MODE') || 'legacy').trim().toLowerCase(),
      gemini: Boolean(getEnv('BACKEND_GEMINI_API_KEY')),
      sessionSecret: Boolean(getEnv('APP_SESSION_SECRET')),
      provisionalSupervisors: getProvisionalSupervisorDiagnostics(),
    },
  });
};

export const config: Config = {
  path: '/api/health',
};
