import type { Config } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { getJsonStore } from './_shared/storage';
import { json } from './_shared/json';
import { cameraReport, DAY, eventKey, isoDay, validEvent } from './_shared/camera-signals';

const store = getJsonStore('criativa-camera-signals-v1');
let cached: ReturnType<typeof cameraReport> | undefined;
export default async (request: Request) => {
  if (!['POST','GET'].includes(request.method)) return json({error:'Método indisponível'},405);
  const auth = await authenticate(request);
  if (!auth) return json({error:'Sessão necessária'},401);
  const now = Date.now();
  try {
    if (request.method === 'GET') {
      if (auth.role !== 'SUPERVISOR') return json({error:'Acesso restrito'},403);
      if (!cached || now - cached.asOf > 30000) {
        const days = [isoDay(now - DAY), isoDay(now)];
        const keys = await Promise.all(days.map(day => store.list(day + '/')));
        cached = cameraReport(keys.flat(),now);
      }
      return json(cached);
    }
    if (auth.role !== 'FIELD_OPS') return json({error:'Acesso restrito'},403);
    if (Number(request.headers.get('content-length')) > 8192) return json({error:'Lote excedido'},413);
    const body = await request.text();
    if (body.length > 8192) return json({error:'Lote excedido'},413);
    let events: unknown;
    try { events = JSON.parse(body).events; } catch { return json({error:'Formato inválido'},400); }
    if (!Array.isArray(events) || events.length < 1 || events.length > 12 || !events.every(validEvent)) return json({error:'Sinais inválidos'},400);
    const recent = events.filter(e => e.at >= now - 7 * DAY && e.at <= now + 120000);
    for (let i = 0; i < recent.length; i += 4) {
      await Promise.all(recent.slice(i,i+4).map(e => store.set(eventKey(auth.sub,e),1)));
    }
    return json({received:true});
  } catch { return json({error:'Monitoramento temporariamente indisponível'},503); }
};
export const config: Config = {path:'/api/camera/monitor'};
