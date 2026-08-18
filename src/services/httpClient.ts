import { appConfig } from '../config/appConfig';
import { expireSession, getSessionToken } from './session';
import {
  getDefaultRetryCount,
  isRetryableHttpStatus,
  shouldExpireAuthSession,
} from './httpPolicy';

type RequestOptions = RequestInit & {
  auth?: boolean;
  timeoutMs?: number;
  retries?: number;
};

export class HttpRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'HttpRequestError';
    this.status = status;
    this.code = code;
  }
}

export class NetworkRequestError extends Error {
  readonly code: 'NETWORK_ERROR' | 'REQUEST_TIMEOUT';

  constructor(message: string, code: 'NETWORK_ERROR' | 'REQUEST_TIMEOUT') {
    super(message);
    this.name = 'NetworkRequestError';
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 25_000;

const joinUrl = (base: string, path: string) => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

export const buildApiUrl = (path: string) => joinUrl(appConfig.apiBaseUrl, path);

const extractErrorDetails = async (response: Response) => {
  const text = await response.text();

  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object' && 'error' in data) {
      return {
        message: String((data as any).error),
        code: 'code' in data ? String((data as any).code) : undefined,
      };
    }
    if (data && typeof data === 'object' && 'message' in data) {
      return {
        message: String((data as any).message),
        code: 'code' in data ? String((data as any).code) : undefined,
      };
    }
  } catch {
    if (text) return { message: text, code: undefined };
  }
  return { message: `Erro HTTP ${response.status}`, code: undefined };
};

const waitBeforeRetry = (attempt: number) => new Promise((resolve) => {
  setTimeout(resolve, 250 * (attempt + 1));
});

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const forwardAbort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', forwardAbort, { once: true });
  const timeoutId = setTimeout(() => controller.abort('request-timeout'), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new NetworkRequestError(
        'A conexão demorou além do limite. Tente novamente.',
        'REQUEST_TIMEOUT',
      );
    }
    if (error instanceof TypeError) {
      throw new NetworkRequestError(
        'Sem conexão com o servidor. Seus dados locais foram preservados.',
        'NETWORK_ERROR',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', forwardAbort);
  }
};

export const requestJson = async <T>(
  path: string,
  {
    auth = true,
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries,
    ...init
  }: RequestOptions = {},
): Promise<T> => {
  const requestHeaders = new Headers(headers || {});
  if (!requestHeaders.has('Content-Type') && init.body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getSessionToken();
    if (!token) {
      expireSession('expired');
      throw new HttpRequestError('Sessão expirada. Faça login novamente.', 401, 'SESSION_MISSING');
    }
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const method = String(init.method || 'GET').toUpperCase();
  const allowedRetries = retries ?? getDefaultRetryCount(method);
  let response: Response | null = null;

  for (let attempt = 0; attempt <= allowedRetries; attempt += 1) {
    try {
      response = await fetchWithTimeout(buildApiUrl(path), {
        ...init,
        headers: requestHeaders,
      }, timeoutMs);
    } catch (error) {
      if (error instanceof NetworkRequestError && attempt < allowedRetries) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw error;
    }

    if (isRetryableHttpStatus(response.status) && attempt < allowedRetries) {
      await waitBeforeRetry(attempt);
      continue;
    }
    break;
  }

  if (!response) {
    throw new NetworkRequestError('Sem resposta do servidor.', 'NETWORK_ERROR');
  }

  if (!response.ok) {
    const { message, code } = await extractErrorDetails(response);
    if (shouldExpireAuthSession(auth, response.status)) {
      expireSession(code === 'SESSION_REPLACED' ? 'replaced' : 'expired');
    }
    throw new HttpRequestError(message, response.status, code);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
};
