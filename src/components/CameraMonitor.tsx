import React, { useEffect, useState } from 'react';
import { requestJson } from '../services/httpClient';
import { getSession } from '../services/session';
import { outcomeLabel, type CameraReport } from '../services/cameraSignals';
import type { SupervisorPromoterOverview } from '../types';

const time = (value: number) => new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function CameraMonitor({promoters}: {promoters: SupervisorPromoterOverview[]}) {
  const [report,setReport] = useState<CameraReport | null>(null);
  const [unavailable,setUnavailable] = useState(false);
  const [search,setSearch] = useState('');
  useEffect(() => {
    let active=true, busy=false;
    const load = async () => {
      if (!active || busy || document.hidden) return;
      const session = getSession();
      if (session?.user.role !== 'SUPERVISOR') return;
      busy=true;
      try {
        const data = await requestJson<CameraReport>('/camera/monitor',{auth:false,headers:{Authorization:'Bearer '+session.token},retries:0,timeoutMs:8000});
        if (active) { setReport(data); setUnavailable(false); }
      } catch { if (active) setUnavailable(true); }
      finally { busy=false; }
    };
    void load();
    const timer=window.setInterval(load,60000);
    document.addEventListener('visibilitychange',load);
    return () => { active=false; clearInterval(timer); document.removeEventListener('visibilitychange',load); };
  },[]);
  const names = new Map(promoters.map(p=>[p.id,p.name]));
  const name = (id:string) => names.get(id) || 'Promotor '+id;
  const rows = report?.rows || [];
  const affected = rows.filter(r=>r.alerts.length);
  const visible = rows.filter(r=>normalize(name(r.owner)).includes(normalize(search)))
    .sort((a,b)=> b.alerts.length-a.alerts.length || b.last.at-a.last.at);
  return <section className="rounded-2xl border bg-white p-4 space-y-2" aria-label="Monitoramento da câmera">
    <h2 className="font-bold">Monitoramento da câmera · últimas 24 horas</h2>
    {unavailable && <p role="status">Monitoramento indisponível agora. A consulta será repetida automaticamente.</p>}
    <div aria-live="polite" className="text-sm">
      {report?.clusters.map(c=><p key={c.build+c.result} className="text-orange-800 font-semibold">{c.count} promotores em 30 min · {outcomeLabel[c.result]} · versão {c.build}</p>)}
      {affected.map(r=><p key={r.owner} className="text-orange-800 font-semibold">{name(r.owner)} · falhas repetidas em {r.alerts.join(', ')}</p>)}
      {report && !affected.length && !report.clusters.length && <p>{rows.length ? 'Nenhum alerta entre as tentativas recebidas.' : 'Aguardando os primeiros sinais dos aparelhos.'}</p>}
    </div>
    <details><summary className="cursor-pointer font-semibold">Consultar capturas por promotor</summary>
      <label className="block my-3">Nome do promotor
        <input className="block border rounded-lg px-3 py-2 w-full" type="search" value={search} onChange={e=>setSearch(e.target.value)} />
      </label>
      {report && <p className="text-sm">Atualizado em {time(report.asOf)} · horários de Brasília.</p>}
      {report && !visible.length && <p>Nenhuma tentativa recebida para essa consulta.</p>}
      {visible.map(r=><article key={r.owner} className="py-3 border-b text-sm">
        <strong>{name(r.owner)}</strong>
        <p>{r.saved} de {r.attempts} tentativas com foto salva{r.attempts ? ' ('+Math.round(r.saved*100/r.attempts)+'%)' : ''}. Cancelamentos e trocas de câmera excluídos.</p>
        <p>Câmera leve em Antes: {r.liteBefore} fotos salvas{r.lastLiteBefore ? ' · última em '+time(r.lastLiteBefore) : ''}.</p>
        <p>Última tentativa: {outcomeLabel[r.last.result]} · {r.last.mode==='lite'?'câmera leve':'câmera do aparelho'} · {r.last.section} · {time(r.last.at)} · {r.last.build}</p>
        {r.lastFailure && <p>Última falha: {outcomeLabel[r.lastFailure.result]} · {r.lastFailure.section} · {time(r.lastFailure.at)}{r.lastFailure.mode==='lite' ? (r.lastFailure.opened?' · prévia abriu':' · prévia não confirmada') : ''}.</p>}
        {r.denied>0 && <p>Permissão negada em {r.denied} tentativa(s).</p>}
      </article>)}
    </details>
  </section>;
}
