import { requestJson, HttpRequestError } from './httpClient';
import { getSession } from './session';
export const photoRecoveryEnabled = (ownerId: string) => ownerId === '101';
const requireOwner = (ownerId: string) => {
  if (String(getSession()?.user.id || '') !== ownerId) throw new Error('A sessao mudou. As fotos foram preservadas.');
};
const request = async (ownerId: string, body: unknown) => {
  requireOwner(ownerId);
  const session = getSession();
  if (!session?.token || String(session.user.id) !== ownerId) throw new Error('A sessao mudou. As fotos foram preservadas.');
  // Authenticate normally, but an auxiliary-copy failure must never sign the
  // promoter out. Core session renewal remains responsible for ending sessions.
  const result = await requestJson<any>('/photos/recovery', { auth: false, headers: { Authorization: `Bearer ${session.token}` }, method: 'POST', retries: 0, timeoutMs: 12000, body: JSON.stringify(body) });
  requireOwner(ownerId); return result;
};
export const recoverPhotoCopy = async (ownerId: string, photoId: string): Promise<{ base64: string; visitId: string } | null> => {
  if (!photoRecoveryEnabled(ownerId) || String(getSession()?.user.id || '') !== ownerId) return null;
  if (!navigator.onLine) throw new Error('Nao foi possivel conferir a copia no servidor sem internet. Dados locais preservados.');
  try {
    const copy = await request(ownerId, { action: 'read', photoId });
    if (typeof copy.base64 !== 'string' || !copy.base64 || typeof copy.visitId !== 'string') throw new Error('Copia remota nao validada.');
    return copy;
  } catch (error) {
    if (error instanceof HttpRequestError && error.status === 404) return null;
    throw error;
  }
};
export const protectPhotoCopy = async (ownerId: string, photoId: string, visitId: string, base64: string, source: 'local' | 'gallery' = 'local') => {
  const result = await request(ownerId, { action: 'save', photoId, visitId, base64, source, clientBuild: document.querySelector('script[type="module"][src]')?.getAttribute('src') || 'unknown' });
  if (!result.protected || !/^[a-f0-9]{64}$/.test(result.sha256 || '')) throw new Error('Copia da foto nao confirmada.');
};
export const recordPhotoDiagnostic = async (ownerId: string, visitId: string, items: { photoId: string; status: string }[]) => {
  let persisted: boolean | null = null, usage: number | null = null, quota: number | null = null;
  try { persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { /* unavailable */ }
  try { const estimate = await navigator.storage?.estimate?.(); usage = estimate?.usage ?? null; quota = estimate?.quota ?? null; } catch { /* unavailable */ }
  return request(ownerId, { action: 'diagnostic', visitId, items, clientBuild: document.querySelector('script[type="module"][src]')?.getAttribute('src') || 'unknown', environment: { persisted, usage, quota, userAgent: navigator.userAgent, deviceMemoryGB: (navigator as any).deviceMemory ?? null, jsHeapBytes: (performance as any).memory?.usedJSHeapSize ?? null } });
};
