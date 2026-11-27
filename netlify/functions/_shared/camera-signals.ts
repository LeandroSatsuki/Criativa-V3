import { cameraSections, outcomes, technicalFailure, type CameraEvent, type CameraReport, type CameraRow } from '../../../src/services/cameraSignals.ts';
export const DAY = 86400000;
export const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
export const validEvent = (e: any): e is CameraEvent => !!e && /^[a-f0-9-]{36}$/.test(e.id) &&
  Number.isSafeInteger(e.at) && e.at > 0 && e.at < 8640000000000000 && cameraSections.includes(e.section) &&
  ['lite','native'].includes(e.mode) && typeof e.opened === 'boolean' && outcomes.includes(e.result) &&
  typeof e.build === 'string' && /^(index-[a-zA-Z0-9_-]{1,64}\.js|unknown)$/.test(e.build);

// All fields are validated scalars. Listing the time partitions suffices to build the report.
export const eventKey = (owner: string, e: CameraEvent) => [isoDay(e.at), Buffer.from(owner).toString('base64url'),
  e.at, e.id, e.section, e.mode, e.opened ? '1' : '0', e.result, e.build].join('/');
export function cameraReport(keys: string[], now: number): CameraReport {
  const events = keys.map(key => {
    const [, who, at, id, section, mode, opened, result, build] = key.split('/');
    return { owner: Buffer.from(who || '', 'base64url').toString(), event: { at: Number(at), id, section, mode, opened: opened === '1', result, build } as CameraEvent };
  }).filter(x => x.owner && validEvent(x.event) && x.event.at >= now - DAY && x.event.at <= now + 120000)
    .sort((a,b) => a.event.at - b.event.at || a.event.id.localeCompare(b.event.id));
  const rows = new Map<string,CameraRow>(), streaks = new Map<string,number>();
  const groups = new Map<string,{build:string; result:CameraEvent['result']; owners:Set<string>}>();
  const seen = new Set<string>();
  for (const { owner, event: e } of events) {
    const identity = owner + '/' + e.id;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const row: CameraRow = rows.get(owner) || {owner, saved:0, attempts:0, failures:0, denied:0, cancelled:0, liteBefore:0, lastLiteBefore:0, last:e, lastFailure:null, alerts:[]};
    rows.set(owner,row); row.last = e;
    const stage = owner + '/' + e.section;
    if (e.result === 'saved') {
      row.saved++; row.attempts++; streaks.delete(stage); row.alerts = row.alerts.filter(s => s !== e.section);
      if (e.section === 'ANTES' && e.mode === 'lite') { row.liteBefore++; row.lastLiteBefore = e.at; }
    } else if (technicalFailure(e.result)) {
      row.attempts++; row.failures++; row.lastFailure = e;
      const count = (streaks.get(stage) || 0) + 1; streaks.set(stage, count);
      if (count >= 2 && !row.alerts.includes(e.section)) row.alerts.push(e.section);
      if (e.at >= now - 1800000) {
        const k = e.build + '/' + e.result;
        const group = groups.get(k) || { build:e.build, result:e.result, owners:new Set<string>() };
        group.owners.add(owner); groups.set(k,group);
      }
    } else if (e.result === 'denied') { row.denied++; row.attempts++; }
    else row.cancelled++;
  }
  return {asOf:now, rows:[...rows.values()], clusters:[...groups.values()].filter(g => g.owners.size >= 3)
    .map(g => ({build:g.build, result:g.result, count:g.owners.size}))};
}
