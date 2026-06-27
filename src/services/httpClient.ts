import { appConfig } from '../config/appConfig';
import { getSessionToken } from './session';

type RequestOptions = RequestInit & {
  auth?: boolean;
};

const joinUrl = (base: string, path: string) => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

export const buildApiUrl = (path: string) => joinUrl(appConfig.apiBaseUrl, path);

const extractErrorMessage = async (response: Response) => {
  const text = await response.text();

  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object' && 'error' in data) {
      return String((data as any).error);
    }
    if (data && typeof data === 'object' && 'message' in data) {
      return String((data as any).message);
    }
  } catch {
    if (text) return text;
  }
  return `Erro HTTP ${response.status}`;
};

export const requestJson = async <T>(
  path: string,
  { auth = true, headers, ...init }: RequestOptions = {},
): Promise<T> => {
  const requestHeaders = new Headers(headers || {});
  if (!requestHeaders.has('Content-Type') && init.body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getSessionToken();
    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: requestHeaders,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
};
