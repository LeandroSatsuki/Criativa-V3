import { appConfig } from '../config/appConfig';
import { clearSession, setSession } from './session';
import { requestJson } from './httpClient';
import type {
  Role,
  SupervisorDashboardResponse,
  SupervisorPromoterDetailResponse,
} from '../types';
import {
  DIRECT_VISIT_PAYLOAD_MAX_BYTES,
  getUtf8ByteLength,
  splitUtf8Text,
} from './visitPayload';

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
  progress?: {
    sent: number;
    total: number;
  };
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

const buildUploadId = async (serializedPayload: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serializedPayload),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const createChunkedVisit = async (payload: any, serializedPayload: string) => {
  const visitId = String(payload.visitId || buildVisitName('VISIT'));
  const chunks = splitUtf8Text(serializedPayload);
  const uploadId = await buildUploadId(serializedPayload);

  for (let index = 0; index < chunks.length; index += 1) {
    await requestJson('/visits/upload', {
      method: 'POST',
      body: toJsonBody({
        action: 'chunk',
        uploadId,
        visitId,
        index,
        total: chunks.length,
        chunk: chunks[index],
      }),
    });
  }

  return requestJson<any>('/visits/upload', {
    method: 'POST',
    body: toJsonBody({
      action: 'finalize',
      uploadId,
      visitId,
      total: chunks.length,
    }),
  });
};

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
    return requestJson<SupervisorDashboardResponse>('/supervisor/dashboard');
  },

  getPromoterExecution: async (id: string) => {
    return requestJson<SupervisorPromoterDetailResponse>(`/supervisor/promoters/${id}`);
  },

  createVisit: async (payload: any) => {
    const payloadWithVisitId = {
      ...payload,
      visitId: payload.visitId || buildVisitName('VISIT'),
    };
    const serializedPayload = toJsonBody(payloadWithVisitId);

    if (getUtf8ByteLength(serializedPayload) > DIRECT_VISIT_PAYLOAD_MAX_BYTES) {
      return createChunkedVisit(payloadWithVisitId, serializedPayload);
    }

    return requestJson<any>('/visits', {
      method: 'POST',
      body: serializedPayload,
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

  syncSavedVisit: async (visitId: string, onProgress?: (message: string) => void) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await apiService.retrySync(visitId);
      if (result.progress && onProgress) {
        onProgress(`Enviando fotos ${result.progress.sent}/${result.progress.total}...`);
      }
      if (result.syncStatus !== 'enviando') return result;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    throw new Error('A sincronização excedeu o limite seguro de tentativas. A visita permanece na fila.');
  },

  getSyncQueue: async () => {
    return requestJson<SyncQueueResponse>('/sync/queue');
  },
};
