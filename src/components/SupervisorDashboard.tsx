import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/apiService';
import { filterSupervisorPromoters, type SupervisorFilter } from '../services/supervisorFilters';
import { buildWhatsAppUrl } from '../services/whatsapp';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronLeft, ChevronRight, RefreshCw, CloudUpload, ArrowUpRight, ListFilter, AlertCircle, TrendingUp, Users, Clock, MapPin, CheckCircle2, Loader2, Route, Search, X, MessageCircle, Phone, CalendarDays } from 'lucide-react';
import type { SupervisorDashboardResponse, SupervisorPromoterDetailResponse, SupervisorPromoterOverview, SupervisorTimelinePoint } from '../types';

import './supervisor.css';

const shiftDay = (day: string, offset: number) => {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const statusClass = (status: string) => status === 'CONCLUÍDO' ? 'success' : status === 'INATIVO' || status === 'SEM ATIVIDADE' ? 'neutral' : 'warning';

const EMPTY_TIMELINE: SupervisorTimelinePoint[] = [
  { time: '08:00', totalVisits: 0, completedVisits: 0, pendingSyncVisits: 0 },
  { time: '10:00', totalVisits: 0, completedVisits: 0, pendingSyncVisits: 0 },
  { time: '12:00', totalVisits: 0, completedVisits: 0, pendingSyncVisits: 0 },
  { time: '14:00', totalVisits: 0, completedVisits: 0, pendingSyncVisits: 0 },
  { time: '16:00', totalVisits: 0, completedVisits: 0, pendingSyncVisits: 0 },
  { time: '18:00', totalVisits: 0, completedVisits: 0, pendingSyncVisits: 0 },
];

const EMPTY_SUMMARY = {
  totalPromoters: 0,
  activePromoters: 0,
  inactivePromoters: 0,
  onlinePromoters: 0,
  offlinePromoters: 0,
  onRoutePromoters: 0,
  activeTodayPromoters: 0,
  inProgressPromoters: 0,
  completedPromoters: 0,
  pendingPromoters: 0,
  pendingSyncVisits: 0,
  pendingSyncPromoters: 0,
  totalVisits: 0,
  completedVisits: 0,
  pendingVisits: 0,
  recordedVisits: 0,
  extraVisits: 0,
  duplicateVisits: 0,
  averageVisitTime: '--:--',
  lastUpdated: '',
};

const EMPTY_DASHBOARD: SupervisorDashboardResponse = {
  summary: EMPTY_SUMMARY,
  timeline: EMPTY_TIMELINE,
  promoters: [],
  lastUpdated: '',
};

const getTodayKey = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const FILTER_INFO: Record<SupervisorFilter, { title: string; description: string }> = {
  all: {
    title: 'Promotores ativos',
    description: 'Equipe ativa no cadastro atual.',
  },
  consult: {
    title: 'Consulta completa',
    description: 'Promotores ativos, inativos e registros históricos.',
  },
  active: {
    title: 'Promotores Cadastrados',
    description: 'Somente promotores presentes atualmente na aba PROMOTORES, sem incluir supervisores ou cadastros históricos.',
  },
  offline: {
    title: 'Sem Atualização Recente',
    description: 'Promotores sem atualização registrada nos últimos 15 minutos.',
  },
  sync_pending: {
    title: 'Pendências de Sincronização',
    description: 'Pessoas com ao menos um envio ainda não confirmado, inclusive pendências de dias anteriores.',
  },
  on_route: {
    title: 'Com Roteiro Hoje',
    description: 'Promotores que possuem ao menos uma loja atribuída para o dia atual. Não representa localização por GPS.',
  },
  in_progress: {
    title: 'Envios em Processamento',
    description: 'Pessoas com sincronização sendo processada pelo backend neste momento.',
  },
  completed: {
    title: 'Visitas Concluídas Hoje',
    description: 'Pessoas que concluíram uma ou mais visitas hoje, considerando o fuso de Brasília.',
  },
  pending: {
    title: 'Visitas Pendentes Hoje',
    description: 'Pessoas com uma ou mais visitas de hoje ainda sem confirmação de envio.',
  },
  duration: {
    title: 'Tempo Médio Hoje',
    description: 'Promotores com visitas concluídas hoje consideradas no cálculo de duração.',
  },
};

const SupervisorDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<SupervisorDashboardResponse>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SupervisorFilter>('all');
  const [selectedDate, setSelectedDate] = useState(getTodayKey);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('attention');
  const [view, setView] = useState<'team' | 'evolution'>('team');
  const [search, setSearch] = useState('');
  const [selectedPromoter, setSelectedPromoter] = useState<SupervisorPromoterOverview | null>(null);
  const [promoterDetail, setPromoterDetail] = useState<SupervisorPromoterDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastDashboardLoad = useRef(0);
  const detailRequestId = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedPromoter) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        detailRequestId.current += 1;
        setSelectedPromoter(null);
        setPromoterDetail(null);
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], summary') || [])
        .filter((element) => element.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [selectedPromoter?.id]);

  useEffect(() => {
    let cancelled = false;
    let pendingLoad: Promise<void> | null = null;
    setLoading(true);
    setError(null);

    const performDashboardLoad = async () => {
      try {
        const response = await apiService.getSupervisorDashboard(selectedDate);
        if (cancelled) return;
        setDashboard(response);
        setError(null);
        lastDashboardLoad.current = Date.now();
      } catch (fetchError: any) {
        if (cancelled) return;
        setError(fetchError?.message || 'Não foi possível carregar o painel do supervisor.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadDashboard = () => {
      if (!pendingLoad) {
        pendingLoad = performDashboardLoad().finally(() => {
          pendingLoad = null;
        });
      }
      return pendingLoad;
    };

    void loadDashboard();
    const refreshWhenVisible = () => {
      if (
        document.visibilityState !== 'hidden' &&
        Date.now() - lastDashboardLoad.current >= 60_000
      ) {
        void loadDashboard();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshWhenVisible();
    };
    const refreshInterval = window.setInterval(refreshWhenVisible, 5 * 60_000);
    window.addEventListener('online', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener('online', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedDate, refreshVersion]);

  const handlePromoterClick = async (promoter: SupervisorPromoterOverview) => {
    const requestId = ++detailRequestId.current;
    setSelectedPromoter(promoter);
    setPromoterDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await apiService.getPromoterExecution(promoter.id, selectedDate);
      if (requestId !== detailRequestId.current) return;
      setPromoterDetail(detail);
    } catch (fetchError: any) {
      if (requestId !== detailRequestId.current) return;
      setDetailError(fetchError?.message || 'Não foi possível carregar os dados do promotor.');
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  };

  const closePromoterDetail = () => {
    detailRequestId.current += 1;
    setSelectedPromoter(null);
    setPromoterDetail(null);
    setDetailError(null);
  };

  const changeDate = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > getTodayKey() || date === selectedDate) return;
    closePromoterDetail();
    setDashboard(EMPTY_DASHBOARD);
    setSelectedDate(date);
  };
  const regions = [...new Set(dashboard.promoters.map((promoter) => promoter.region).filter(Boolean))].sort();
  const filteredData = filterSupervisorPromoters(dashboard.promoters, filter, search)
    .filter((promoter) => !region || promoter.region === region)
    .sort((left, right) => {
      if (sort === 'attention' && left.pendingSyncVisits !== right.pendingSyncVisits) return right.pendingSyncVisits - left.pendingSyncVisits;
      if (sort === 'progress' && left.progress !== right.progress) return right.progress - left.progress;
      return left.name.localeCompare(right.name, 'pt-BR');
    });
  const selectFilter = (nextFilter: SupervisorFilter) => {
    setSearch('');
    setView('team');
    setFilter((current) => current === nextFilter ? 'all' : nextFilter);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resultsRef.current?.focus({ preventScroll: true });
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const chartData = dashboard.timeline;
  const historical = selectedDate !== getTodayKey();
  const dateLabel = new Date(`${selectedDate}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const whatsappUrl = selectedPromoter ? buildWhatsAppUrl(selectedPromoter.phone) : null;

  const completion = dashboard.summary.totalVisits ? Math.round(dashboard.summary.completedVisits / dashboard.summary.totalVisits * 100) : 0;
  const metrics = [
    { key: 'completed' as const, label: 'Lojas concluídas', value: dashboard.summary.completedVisits + ' / ' + dashboard.summary.totalVisits, subtitle: completion + '% do roteiro', icon: CheckCircle2, tone: 'success' },
    { key: 'sync_pending' as const, label: 'Envios pendentes', value: dashboard.summary.pendingSyncVisits, subtitle: dashboard.summary.pendingSyncPromoters + ' promotores · todos os dias', icon: CloudUpload, tone: 'warning' },
    { key: 'active' as const, label: 'Equipe cadastrada', value: dashboard.summary.totalPromoters, subtitle: dashboard.summary.activePromoters + ' ativos · ' + dashboard.summary.inactivePromoters + ' inativos', icon: Users, tone: 'blue' },
    { key: 'duration' as const, label: 'Tempo médio em loja', value: dashboard.summary.averageVisitTime, subtitle: dashboard.summary.recordedVisits + ' registros no dia', icon: Clock, tone: 'neutral' },
  ];

  if (loading && !dashboard.lastUpdated) return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="animate-spin text-[#E65C5C]" size={32} />
    </div>
  );

  if (error && !dashboard.lastUpdated) {
    return (
      <div className="h-64 flex items-center justify-center text-center px-6">
        <div className="space-y-3">
          <p className="text-sm font-black uppercase tracking-widest text-[#0F172A]">Painel indisponível</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-sm">{error}</p>
          <button className="sv-button" onClick={() => setRefreshVersion((value) => value + 1)}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="supervisor-workspace">
      {selectedPromoter && (
        <div className="fixed inset-0 z-[90] bg-[#0F172A]/55 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={closePromoterDetail}>
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="promoter-detail-title"
            className="sv-legacy-detail w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-white rounded-[32px] md:rounded-[40px] shadow-2xl border border-slate-100"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-5 md:px-8 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E65C5C]">Dados do promotor</p>
                <h2 id="promoter-detail-title" className="text-2xl font-black uppercase tracking-tight text-[#0F172A] truncate">{selectedPromoter.name}</h2>
              </div>
              <button onClick={closePromoterDetail} aria-label="Fechar dados do promotor" className="w-10 h-10 shrink-0 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <details className="sv-contact-details">
                <summary><Phone size={15} /> Contato e cadastro</summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-3xl p-5 space-y-3">
                  <div><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">ID</p><p className="text-sm font-black text-[#0F172A]">{selectedPromoter.id}</p></div>
                  <div><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Usuário</p><p className="text-sm font-black text-[#0F172A]">{selectedPromoter.user || 'Não informado'}</p></div>
                  <div><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Regional</p><p className="text-sm font-black text-[#0F172A]">{selectedPromoter.region || 'Não informada'}</p></div>
                  <div><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Situação cadastral</p><p className={`text-sm font-black ${selectedPromoter.registrationStatus === 'INATIVO' ? 'text-red-600' : 'text-emerald-600'}`}>{selectedPromoter.registrationStatus}</p></div>
                </div>
                <div className="bg-slate-50 rounded-3xl p-5 space-y-4">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Telefone</p>
                    <p className="text-sm font-black text-[#0F172A] flex items-center gap-2"><Phone size={14} /> {selectedPromoter.phone || 'Não cadastrado'}</p>
                  </div>
                  {whatsappUrl ? (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 text-white rounded-2xl py-3 px-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <MessageCircle size={16} /> Abrir WhatsApp
                    </a>
                  ) : (
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cadastre um telefone válido na planilha para habilitar o WhatsApp.</p>
                  )}
                </div>
              </div>
              </details>

              {detailLoading && <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-[#E65C5C]" size={28} /></div>}
              {detailError && <div className="bg-red-50 text-red-600 rounded-2xl p-4 text-[10px] font-black uppercase tracking-wider">{detailError}</div>}
              {promoterDetail && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-[8px] font-black uppercase text-slate-400">Roteiro {dateLabel}</p><p className="text-xl font-black">{promoterDetail.metrics.totalVisits}</p></div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-[8px] font-black uppercase text-slate-400">Concluídas</p><p className="text-xl font-black text-emerald-600">{promoterDetail.metrics.completedVisits}</p></div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-[8px] font-black uppercase text-slate-400">Envios pendentes</p><p className="text-xl font-black text-orange-600">{promoterDetail.metrics.pendingSyncVisits}</p></div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-[8px] font-black uppercase text-slate-400">Tempo médio</p><p className="text-xl font-black">{promoterDetail.metrics.averageDuration}</p></div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roteiro previsto</h3>
                    {historical && <p className="text-[10px] text-slate-500">Lojas previstas conforme o cadastro atual. A rota original desta data pode ter sido diferente.</p>}
                    {(promoterDetail.plannedRoute || []).length === 0 && <p className="text-xs text-slate-500">Nenhuma loja prevista no cadastro atual.</p>}
                    {(promoterDetail.plannedRoute || []).map((stop) => (
                      <div key={stop.id} className="border-b border-slate-100 py-3 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 font-semibold text-[#0F172A]">{stop.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{stop.status} · {stop.duration}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visitas registradas em {dateLabel}</h3>
                    {promoterDetail.route.length === 0 && <p className="bg-slate-50 rounded-2xl p-5 text-[10px] font-bold uppercase text-slate-400">Nenhuma visita registrada.</p>}
                    {promoterDetail.route.map((stop) => (
                      <div key={stop.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div><p className="text-sm font-black uppercase text-[#0F172A]">{stop.name}</p><p className="text-[9px] font-bold uppercase text-slate-400">{stop.date} às {stop.time} • {stop.photos} fotos • {stop.duration || '--:--'} em loja</p>{stop.automaticCheckout && <p className="text-xs text-amber-700 mt-1">Encerramento automático às 18h</p>}</div>
                        <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-[8px] font-black uppercase ${stop.status === 'CONCLUÍDO' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>{stop.status}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="sv-heading">
        <div><p className="sv-eyebrow">Acompanhamento da operação</p><h2>Visão da equipe</h2><p className="sv-muted">{historical ? dateLabel : 'Hoje'} · {dashboard.lastUpdated ? 'Atualizado às ' + new Date(dashboard.lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : 'Aguardando dados'}</p></div>
        <div className="sv-date-tools">
          <button className="sv-icon" title="Dia anterior" aria-label="Dia anterior" onClick={() => changeDate(shiftDay(selectedDate, -1))}><ChevronLeft size={18} /></button>
          <label className="sv-date"><CalendarDays size={17} /><input type="date" aria-label="Data da análise" value={selectedDate} max={getTodayKey()} onChange={(event) => changeDate(event.target.value)} /></label>
          <button className="sv-icon" title="Dia seguinte" aria-label="Dia seguinte" disabled={!historical} onClick={() => changeDate(shiftDay(selectedDate, 1))}><ChevronRight size={18} /></button>
          {historical && <button className="sv-button" onClick={() => changeDate(getTodayKey())}>Hoje</button>}
          <button className="sv-icon" title="Atualizar painel" aria-label="Atualizar painel" disabled={loading} onClick={() => setRefreshVersion((value) => value + 1)}><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>
      {historical && <p className="sv-notice">Registros de {dateLabel}. O roteiro previsto usa as atribuições atuais; a rota original pode ter sido diferente.</p>}
      {error && <div className="sv-notice sv-error" role="alert"><AlertCircle size={18} /><span>Exibindo a última consulta. {error}</span></div>}
      <div className="sv-metrics">
        {metrics.map(({ key, label, value, subtitle, icon: Icon, tone }) => <button key={key} className={'sv-metric ' + (filter === key ? 'selected' : '')} aria-pressed={filter === key} onClick={() => selectFilter(key)}>
          <div className="sv-metric-label"><Icon size={18} className={'sv-text-' + tone} /><span>{label}</span><ArrowUpRight size={15} /></div><strong>{value}</strong><span className="sv-muted">{subtitle}</span>
        </button>)}
      </div>
      <div className="sv-operational-strip">
        <button onClick={() => selectFilter('on_route')}><Route size={16} /><strong>{dashboard.summary.onRoutePromoters}</strong> com roteiro</button>
        <span><strong>{dashboard.summary.pendingVisits}</strong> lojas ainda não concluídas</span>
        <button onClick={() => selectFilter('in_progress')}><Loader2 size={16} /><strong>{dashboard.summary.inProgressPromoters}</strong> processando envios</button>
        <button onClick={() => selectFilter('offline')} title="Sem atualização nos últimos 15 minutos; não confirma falta de internet"><strong>{dashboard.summary.offlinePromoters}</strong> sem atualização recente</button>
      </div>
      <div className="sv-view-tabs" role="tablist" aria-label="Visão do painel">
        <button role="tab" aria-selected={view === 'team'} aria-controls="sv-team-panel" id="sv-team-tab" onClick={() => setView('team')}><Users size={17} /> Equipe</button>
        <button role="tab" aria-selected={view === 'evolution'} aria-controls="sv-evolution-panel" id="sv-evolution-tab" onClick={() => setView('evolution')}><TrendingUp size={17} /> Evolução do dia</button>
      </div>
      <div ref={resultsRef} className="sv-results">
        {view === 'team' ? <section role="tabpanel" id="sv-team-panel" aria-labelledby="sv-team-tab">
          <div className="sv-filters">
            <label className="sv-search"><Search size={18} /><input ref={searchRef} aria-label="Buscar promotor" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, loja, telefone ou região" />{search && <button title="Limpar busca" aria-label="Limpar busca" onClick={() => setSearch('')}><X size={16} /></button>}</label>
            <label className="sv-select"><ListFilter size={16} /><select aria-label="Situação da equipe" value={filter} onChange={(event) => setFilter(event.target.value as SupervisorFilter)}>{Object.entries(FILTER_INFO).map(([key, info]) => <option key={key} value={key}>{info.title.replaceAll('Hoje', historical ? dateLabel : 'Hoje')}</option>)}</select></label>
            <label className="sv-select"><MapPin size={16} /><select aria-label="Região" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">Todas as regiões</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <div className="sv-list-meta"><p aria-live="polite"><strong>{filteredData.length}</strong> promotores{(filter !== 'all' || search || region) && <button className="sv-link" onClick={() => { setFilter('all'); setSearch(''); setRegion(''); }}>Limpar filtros</button>}</p><label>Ordenar por <select aria-label="Ordenar promotores" value={sort} onChange={(event) => setSort(event.target.value)}><option value="attention">Envios pendentes</option><option value="name">Nome</option><option value="progress">Conclusão do roteiro</option></select></label></div>
          <div className="sv-table-head" aria-hidden="true"><span>Promotor / última loja</span><span>Roteiro do dia</span><span>Sincronização</span><span /></div>
          {filteredData.length === 0 && <div className="sv-empty"><Search size={25} /><p>Nenhum promotor encontrado.</p><button className="sv-button" onClick={() => { setFilter('consult'); setSearch(''); setRegion(''); }}>Consultar todos</button></div>}
          {filteredData.map((promoter) => <button key={promoter.id} className="sv-promoter" onClick={() => void handlePromoterClick(promoter)} aria-label={'Ver detalhes de ' + promoter.name}>
            <div className="sv-identity"><span className="sv-avatar" aria-hidden="true">{promoter.name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2)}<i className={promoter.online ? 'recent' : ''} /></span><div><strong>{promoter.name}</strong><span className="sv-store"><MapPin size={12} />{promoter.store || 'Sem registro de loja'}</span><span className={'sv-status ' + statusClass(promoter.status)}>{promoter.status}</span>{promoter.region && <span className="sv-region">{promoter.region}</span>}</div></div>
            <div className="sv-route-progress"><span><strong>{promoter.todayVisits.completed}/{promoter.todayVisits.total}</strong> lojas <b>{promoter.progress}%</b></span><div className="sv-progress" role="progressbar" aria-label={'Roteiro de ' + promoter.name} aria-valuenow={Math.min(100, promoter.progress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: Math.min(100, Math.max(0, promoter.progress)) + '%' }} /></div>{(promoter.todayVisits.extra > 0 || promoter.todayVisits.duplicates > 0) && <small>{promoter.todayVisits.extra} extras · {promoter.todayVisits.duplicates} duplicadas</small>}</div>
            <div className="sv-sync-cell">{promoter.pendingSyncVisits ? <span className="sv-text-warning"><CloudUpload size={15} />{promoter.pendingSyncVisits} pendente(s)</span> : <span className="sv-text-success"><CheckCircle2 size={15} />Sem pendências</span>}<small>Última sinc. {promoter.lastSync}</small></div><ChevronRight size={18} className="sv-row-arrow" />
          </button>)}
        </section> : <section role="tabpanel" id="sv-evolution-panel" aria-labelledby="sv-evolution-tab" className="sv-evolution">
          <div className="sv-chart-heading"><div><h3>Visitas ao longo do dia</h3><p className="sv-muted">{dateLabel} · horário de Brasília</p></div><div><strong>{completion}%</strong><span className="sv-muted"> do roteiro concluído</span></div></div>
          <div className="sv-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" /><XAxis dataKey="time" fontSize={12} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} fontSize={12} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 14 }} /><Line isAnimationActive={false} type="monotone" dataKey="totalVisits" name="Registros" stroke="#2563eb" strokeWidth={2} dot={false} /><Line isAnimationActive={false} type="monotone" dataKey="completedVisits" name="Concluídas" stroke="#059669" strokeWidth={2} dot={false} /><Line isAnimationActive={false} type="monotone" dataKey="pendingSyncVisits" name="Pendências" stroke="#c27803" strokeWidth={2} strokeDasharray="5 5" dot={false} /></LineChart></ResponsiveContainer></div>
          <div className="sv-operational-strip"><span><strong>{dashboard.summary.totalVisits}</strong> lojas previstas</span><span><strong>{dashboard.summary.recordedVisits}</strong> registros</span><span><strong>{dashboard.summary.extraVisits}</strong> extras</span><span><strong>{dashboard.summary.duplicateVisits}</strong> duplicadas</span></div>
        </section>}
      </div>
    </div>
  );
};

export default SupervisorDashboard;
