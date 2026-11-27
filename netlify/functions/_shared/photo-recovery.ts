import { createHash } from 'node:crypto';
import { json } from './json.ts';
type Store = { get<T>(key: string): Promise<T | null>; set(key: string, value: unknown): Promise<void>; list(prefix: string): Promise<string[]> };
type Auth = { sub: string; role: string };
type Copy = { ownerId: string; photoId: string; visitId: string; base64: string; sha256: string; createdAt: string; source: 'local' | 'gallery'; clientBuild: string };
const MAX_BYTES = 120 * 1024;
export const createPhotoRecoveryHandler = (deps: { authenticate: (request: Request) => Promise<Auth | null>; photos: Store; diagnostics: Store }) => async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  const auth = await deps.authenticate(request);
  if (!auth) return json({ error: 'Nao autorizado.' }, 401);
  // Controlled pilot; other promoters keep their current flow and traffic.
  if (auth.sub !== '101' || auth.role !== 'FIELD_OPS') return json({ error: 'Recuperacao nao habilitada para esta conta.' }, 403);
  if (Number(request.headers.get('content-length')) > 200000) return json({ error: 'Arquivo acima do limite.' }, 413);
  const text = await request.text();
  if (text.length > 200000) return json({ error: 'Arquivo acima do limite.' }, 413);
  let body: any; try { body = JSON.parse(text); } catch { return json({ error: 'Dados invalidos.' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Dados invalidos.' }, 400);
  if (body.action === 'diagnostic') {
    if (!/^VISIT-[A-Za-z0-9_-]{1,120}$/.test(body.visitId || '') || !Array.isArray(body.items) || body.items.length > 500) return json({ error: 'Diagnostico invalido.' }, 400);
    const items = body.items.map((item: any) => ({ photoId: String(item?.photoId || '').slice(0, 180), status: ['protected', 'missing', 'failed'].includes(item?.status) ? item.status : 'failed' }));
    const environment = body.environment || {};
    const metric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
    await deps.diagnostics.set(`${auth.sub}/${body.visitId}/${Date.now()}`, { ownerId: auth.sub, visitId: body.visitId, version: 'photo-safety-2026-11-25', clientBuild: String(body.clientBuild || '').slice(0, 100), items, environment: { persisted: typeof environment.persisted === 'boolean' ? environment.persisted : null, usage: metric(environment.usage), quota: metric(environment.quota), userAgent: String(environment.userAgent || '').slice(0, 400), deviceMemoryGB: metric(environment.deviceMemoryGB), jsHeapBytes: metric(environment.jsHeapBytes) }, createdAt: new Date().toISOString() });
    return json({ recorded: true });
  }
  const match = /^criativa-photo-v1:101:([a-f0-9-]{36})$/i.exec(String(body.photoId || ''));
  if (!match) return json({ error: 'Foto invalida ou de outra conta.' }, 400);
  const prefix = `photos/${auth.sub}/${match[1]}/`;
  const keys = await deps.photos.list(prefix);
  if (body.action === 'read') {
    if (!keys.length) return json({ error: 'Nao existe copia desta foto.' }, 404);
    if (keys.length !== 1) return json({ error: 'Copias divergentes. Registros preservados para suporte.' }, 409);
    const copy = await deps.photos.get<Copy>(keys[0]);
    if (!copy || copy.ownerId !== auth.sub || copy.photoId !== body.photoId || typeof copy.base64 !== 'string' || createHash('sha256').update(copy.base64).digest('hex') !== copy.sha256) return json({ error: 'Copia nao validada.' }, 409);
    return json({ base64: copy.base64, sha256: copy.sha256, visitId: copy.visitId });
  }
  if (body.action !== 'save') return json({ error: 'Acao invalida.' }, 400);
  if (!/^VISIT-[A-Za-z0-9_-]{1,120}$/.test(body.visitId || '') || typeof body.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.base64)) return json({ error: 'Imagem ou visita invalida.' }, 400);
  const bytes = Buffer.from(body.base64, 'base64');
  if (bytes.length > MAX_BYTES) return json({ error: 'Foto acima do limite.' }, 413);
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes.toString('base64') !== body.base64) return json({ error: 'Foto JPEG invalida.' }, 400);
  const sha256 = createHash('sha256').update(body.base64).digest('hex');
  const key = prefix + sha256;
  // Content-addressed objects: divergent writes never replace existing bytes.
  if (keys.some(existing => existing !== key)) return json({ error: 'Uma copia diferente ja existe. Fontes preservadas.' }, 409);
  if (!keys.length) await deps.photos.set(key, { ownerId: auth.sub, photoId: body.photoId, visitId: body.visitId, base64: body.base64, sha256, createdAt: new Date().toISOString(), source: body.source === 'gallery' ? 'gallery' : 'local', clientBuild: String(body.clientBuild || '').slice(0, 100) } satisfies Copy);
  const saved = await deps.photos.get<Copy>(key);
  if (saved?.base64 !== body.base64 || saved?.ownerId !== auth.sub || saved?.photoId !== body.photoId || saved?.sha256 !== sha256) return json({ error: 'Copia nao confirmada. Foto local preservada.' }, 503);
  return json({ protected: true, sha256 });
};
