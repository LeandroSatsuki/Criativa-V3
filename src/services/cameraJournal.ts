import { getSession } from './session';
import { requestJson } from './httpClient';
import { isPhotoCaptureBusy } from './liteMode';
import { setCameraChoice } from './visitCameraChoice';
import type { CameraEvent, Outcome } from './cameraSignals';

const slots = 64, day = 86400000, marker = 'criativa_camera_active_v1';
type RecordItem = Omit<CameraEvent,'result'> & {result: Outcome | null};
export type Attempt = { ready: () => void; end: (result: Outcome) => void };
const noSignal: Attempt = { ready() {}, end() {} };
let cursor = 0, nextTimer = 0, scheduledAt = 0, retryMs = 8000, busy = false, owner = '';
const key = (id: string, i: number) => 'criativa_camera_v1:' + encodeURIComponent(id) + ':' + i;
const read = (k: string): RecordItem | null => {
  const raw = localStorage.getItem(k);
  if (!raw) return null;
  try { const value=JSON.parse(raw); return value && typeof value.id==='string' && Number.isFinite(value.at) ? value : null; }
  catch { return null; }
};
const schedule = (delay: number) => {
  const due = Date.now()+delay;
  if (!owner || (nextTimer && scheduledAt <= due)) return;
  clearTimeout(nextTimer); scheduledAt = due;
  nextTimer = window.setTimeout(() => { nextTimer = 0; void flush(); },delay);
};
async function flush() {
  const id = owner;
  if (!id || busy || !navigator.onLine || document.hidden) return;
  if (isPhotoCaptureBusy()) { schedule(8000); return; }
  const session = getSession();
  if (!session || String(session.user.id) !== id || session.user.role !== 'FIELD_OPS') return;
  busy = true;
  try {
    const batch: { k: string; event: RecordItem }[] = [];
    let liveLocks: Set<string> | undefined;
    for (let i=0; i<slots && batch.length<12; i++) {
      const k = key(id,i), event = read(k);
      if (!event) continue;
      if (event.at < Date.now()-7*day) { localStorage.removeItem(k); continue; }
      if (!event.result && event.at < Date.now()-120000 && navigator.locks?.query) {
        liveLocks ||= new Set((await navigator.locks.query()).held?.map(lock=>lock.name));
        if (!liveLocks.has('criativa-camera-'+event.id) && read(k)?.result === null) {
          event.result='interrupted'; localStorage.setItem(k,JSON.stringify(event));
          if (event.mode === 'native' && !event.opened && Date.now()-event.at < 600000) setCameraChoice(id,'lite');
        }
      }
      if (!event.result) schedule(125000);
      if (event.result) batch.push({k,event});
    }
    if (!batch.length) return;
    const ack = await requestJson<{received:boolean}>('/camera/monitor', {auth:false,
      headers:{Authorization:'Bearer '+session.token},method:'POST',retries:0,timeoutMs:6000,
      body:JSON.stringify({events:batch.map(x=>x.event)})});
    if (!ack.received) throw new Error();
    for (const {k,event} of batch) if (read(k)?.id === event.id) localStorage.removeItem(k);
    retryMs = 8000;
    if (batch.length === 12) schedule(3000);
  } catch { schedule(retryMs); retryMs = Math.min(300000,retryMs*2); }
  finally { busy = false; }
}
export function startCameraMonitor(id: string) {
  owner = id;
  try {
    const k = sessionStorage.getItem(marker);
    if (k?.startsWith('criativa_camera_v1:'+encodeURIComponent(id)+':')) {
      const pending = read(k);
      if (pending && !pending.result) {
        localStorage.setItem(k,JSON.stringify({...pending,result:'interrupted'}));
        if (pending.mode === 'native' && !pending.opened && Date.now()-pending.at < 600000) setCameraChoice(id,'lite');
      }
      sessionStorage.removeItem(marker);
    }
  } catch { /* Monitoring is optional when device storage is unavailable. */ }
  const resume = () => schedule(2500);
  resume();
  window.addEventListener('online',resume);
  document.addEventListener('visibilitychange',resume);
  return () => { owner=''; clearTimeout(nextTimer); nextTimer=0; window.removeEventListener('online',resume); document.removeEventListener('visibilitychange',resume); };
}

export function beginCameraAttempt(section: string, mode: CameraEvent['mode']): Attempt {
  try {
    if (!owner) return noSignal;
    const attemptOwner = owner;
    const id = crypto.randomUUID(), at = Date.now();
    let k = '', oldestKey = '', oldestTime = Infinity;
    for (let n=0;n<slots;n++) {
      cursor = (cursor+1)%slots;
      const candidate = key(owner,cursor), old = read(candidate);
      if (!old || old.at < at-7*day) { k=candidate; break; }
      if (old.result && old.at < oldestTime) { oldestTime=old.at; oldestKey=candidate; }
    }
    k ||= oldestKey;
    if (!k) return noSignal;
    const build = document.querySelector('script[type="module"][src]')?.getAttribute('src')?.match(/(index-[\w-]+\.js)$/)?.[1] || 'unknown';
    const event: RecordItem = {id,at,section,mode,build,opened:false,result:null};
    localStorage.setItem(k,JSON.stringify(event));
    // A live tab owns its attempt. After Android kills the process its lock disappears.
    let unlock: (()=>void) | undefined;
    if (navigator.locks) void navigator.locks.request('criativa-camera-'+id,() => {
      if (!event.result) return new Promise<void>(resolve => { unlock=resolve; });
    }).catch(()=>{});
    try { sessionStorage.setItem(marker,k); } catch {}
    return {
      ready() { try {
        if (!event.result && !event.opened && read(k)?.id === id) {
          event.opened=true; localStorage.setItem(k,JSON.stringify(event));
        }
      } catch {} },
      end(result) { try {
        if (event.result || read(k)?.id !== id) return;
        event.result=result; unlock?.(); localStorage.setItem(k,JSON.stringify(event));
        if (result === 'interrupted' && mode === 'native' && !event.opened) setCameraChoice(attemptOwner,'lite');
        if (sessionStorage.getItem(marker)===k) sessionStorage.removeItem(marker);
        schedule(8000);
      } catch {} },
    };
  } catch { return noSignal; }
}
