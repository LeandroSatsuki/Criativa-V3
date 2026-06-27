import { appConfig } from '../config/appConfig';
import { clearSession, setSession } from './session';
import { requestJson } from './httpClient';
import type { Role, SectionId } from '../types';

const APP_CONFIG_CACHE = 'CRIATIVA_APP_CONFIG_CACHE';

type AppConfigResponse = {
  industries: string[];
  timestamp: string | null;
};

type LoginResponse = {
  user: {
    id: string;
    name: string;
    role: Role;
    region?: string;
    user: string;
  };
  token: string;
};

type SyncResponse = {
  visitId: string;
  syncStatus: string;
  syncError?: string | null;
};

type SyncQueueResponse = {
  count: number;
  queue: Array<{
    visitId: string;
    syncStatus: string;
    syncError: string | null;
    createdAt: string;
    updatedAt: string;
    store: string;
    promoter: string;
    region: string;
  }>;
};

export const getBrasiliaDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * -3));
};

export const getBrasiliaISO = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now).replace(' ', 'T');
};

const readCachedConfig = (): AppConfigResponse | null => {
  try {
    const raw = localStorage.getItem(APP_CONFIG_CACHE);
    return raw ? (JSON.parse(raw) as AppConfigResponse) : null;
  } catch {
    return null;
  }
};

const writeCachedConfig = (config: AppConfigResponse) => {
  localStorage.setItem(APP_CONFIG_CACHE, JSON.stringify(config));
};

const buildVisitName = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
};

const toJsonBody = (data: unknown) => JSON.stringify(data);

export const apiService = {
  getAppConfig: async (force = false) => {
    if (!force) {
      const cached = readCachedConfig();
      if (cached) return cached;
    }

    try {
      const config = await requestJson<AppConfigResponse>('/config', { auth: false });
      const normalized = {
        industries: config.industries?.length ? config.industries : appConfig.defaultIndustries,
        timestamp: config.timestamp || null,
      };
      writeCachedConfig(normalized);
      return normalized;
    } catch (error) {
      const cached = readCachedConfig();
      if (cached) return cached;
      return {
        industries: appConfig.defaultIndustries,
        timestamp: null,
      };
    }
  },

  login: async (credentials: { user: string; pass: string }) => {
    const response = await requestJson<LoginResponse>('/auth/login', {
      auth: false,
      method: 'POST',
      body: toJsonBody(credentials),
    });

    setSession({
      token: response.token,
      user: response.user,
      issuedAt: getBrasiliaISO(),
    });

    return response.user;
  },

  clearSession,

  getStores: async (promoterId: string) => {
    const query = new URLSearchParams({ userId: promoterId });
    return requestJson<any[]>(`/stores?${query.toString()}`);
  },

  syncVisit: async (payload: any, onProgress?: (msg: string) => void) => {
    if (onProgress) onProgress('Preparando dados para envio...');

    const payloadWithMetadata = {
      ...payload,
      timestamp: payload.timestamp || getBrasiliaISO(),
      visitId: payload.visitId || buildVisitName('VISIT'),
    };

    if (onProgress) onProgress('Enviando dados para o backend seguro...');
    return requestJson<SyncResponse>('/visits/sync', {
      method: 'POST',
      body: toJsonBody(payloadWithMetadata),
    });
  },

  pingMake: async () => {
    const health = await requestJson<{ ok: boolean }>('/health', { auth: false });
    return Boolean(health.ok);
  },

  getSupervisorDashboard: async () => {
    return requestJson<any[]>('/supervisor/dashboard');
  },

  getPromoterExecution: async (id: string) => {
    return requestJson<any>(`/supervisor/promoters/${id}`);
  },

  createVisit: async (payload: any) => {
    return requestJson<any>('/visits', {
      method: 'POST',
      body: toJsonBody(payload),
    });
  },

  updateVisit: async (visitId: string, payload: any) => {
    return requestJson<any>(`/visits/${visitId}`, {
      method: 'PATCH',
      body: toJsonBody(payload),
    });
  },

  getSyncStatus: async (visitId: string) => {
    return requestJson<any>(`/sync/${visitId}/status`);
  },

  retrySync: async (visitId: string) => {
    return requestJson<SyncResponse>(`/sync/${visitId}/retry`, {
      method: 'POST',
    });
  },

  getSyncQueue: async () => {
    return requestJson<SyncQueueResponse>('/sync/queue');
  },
};
