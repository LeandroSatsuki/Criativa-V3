import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/apiService';
import { filterSupervisorPromoters, type SupervisorFilter } from '../services/supervisorFilters';
import { buildWhatsAppUrl } from '../services/whatsapp';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Users, Clock, MapPin, CheckCircle2, Loader2, Route, Play, ClipboardList, SignalLow, Search, X, MessageCircle, Phone } from 'lucide-react';
import type { SupervisorDashboardResponse, SupervisorPromoterDetailResponse, SupervisorPromoterOverview, SupervisorTimelinePoint } from '../types';

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
  averageVisitTime: '--:--',
  lastUpdated: '',
};

const EMPTY_DASHBOARD: SupervisorDashboardResponse = {
  summary: EMPTY_SUMMARY,
  timeline: EMPTY_TIMELINE,
  promoters: [],
  lastUpdated: '',
};

const FILTER_INFO: Record<SupervisorFilter, { title: string; description: string }> = {
  all: {
    title: 'Visão Geral',
    description: 'Cadastros atuais e usuários históricos que ainda possuem registros operacionais.',
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
    title: 'Em Atividade Hoje',
    description: 'Promotores com pelo menos uma visita registrada hoje. Este indicador não representa localização por GPS.',
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
  const [search, setSearch] = useState('');
  const [selectedPromoter, setSelectedPromoter] = useState<SupervisorPromoterOverview | null>(null);
  const [promoterDetail, setPromoterDetail] = useState<SupervisorPromoterDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        const response = await apiService.getSupervisorDashboard();
        if (cancelled) return;
        setDashboard(response);
        setError(null);
      } catch (fetchError: any) {
        if (cancelled) return;
        setDashboard(EMPTY_DASHBOARD);
        setError(fetchError?.message || 'Não foi possível carregar o painel do supervisor.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDashboard();
    const refreshInterval = window.setInterval(() => void loadDashboard(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, []);

  const handlePromoterClick = async (promoter: SupervisorPromoterOverview) => {
    setSelectedPromoter(promoter);
    setPromoterDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await apiService.getPromoterExecution(promoter.id);
      setPromoterDetail(detail);
    } catch (fetchError: any) {
      setDetailError(fetchError?.message || 'Não foi possível carregar os dados do promotor.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closePromoterDetail = () => {
    setSelectedPromoter(null);
    setPromoterDetail(null);
    setDetailError(null);
  };

  const filteredData = filterSupervisorPromoters(dashboard.promoters, filter, search);
  const activeFilterInfo = FILTER_INFO[filter];
  const selectFilter = (nextFilter: SupervisorFilter) => {
    setSearch('');
    setFilter((current) => current === nextFilter ? 'all' : nextFilter);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resultsRef.current?.focus({ preventScroll: true });
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const chartData = dashboard.timeline;
  const whatsappUrl = selectedPromoter ? buildWhatsAppUrl(selectedPromoter.phone) : null;

  if (loading) return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="animate-spin text-[#E65C5C]" size={32} />
    </div>
  );

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center text-center px-6">
        <div className="space-y-3">
          <p className="text-sm font-black uppercase tracking-widest text-[#0F172A]">Painel indisponível</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in">
      {selectedPromoter && (
        <div className="fixed inset-0 z-[90] bg-[#0F172A]/55 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={closePromoterDetail}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promoter-detail-title"
            className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-white rounded-[32px] md:rounded-[40px] shadow-2xl border border-slate-100"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-3xl p-5 space-y-3">
                  <div><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">ID</p><p className="text-sm font-black text-[#0F172A]">{selectedPromoter.id}</p></div>
                  <div><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Usuário</p><p className="text-sm font-black text-[#0F172A]">{selectedPromoter.user || 'Não informado'}</p></div>
                  <div><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Regional</p><p className="text-sm font-black text-[#0F172A]">{selectedPromoter.region || 'Não informada'}</p></div>
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

              {detailLoading && <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-[#E65C5C]" size={28} /></div>}
              {detailError && <div className="bg-red-50 text-red-600 rounded-2xl p-4 text-[10px] font-black uppercase tracking-wider">{detailError}</div>}
              {promoterDetail && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-[8px] font-black uppercase text-slate-400">Visitas hoje</p><p className="text-xl font-black">{promoterDetail.metrics.totalVisits}</p></div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-[8px] font-black uppercase text-slate-400">Concluídas</p><p className="text-xl font-black text-emerald-600">{promoterDetail.metrics.completedVisits}</p></div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-[8px] font-black uppercase text-slate-400">Pendentes</p><p className="text-xl font-black text-orange-600">{promoterDetail.metrics.pendingSyncVisits}</p></div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-[8px] font-black uppercase text-slate-400">Tempo médio</p><p className="text-xl font-black">{promoterDetail.metrics.averageDuration}</p></div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visitas recentes</h3>
                    {promoterDetail.route.length === 0 && <p className="bg-slate-50 rounded-2xl p-5 text-[10px] font-bold uppercase text-slate-400">Nenhuma visita registrada.</p>}
                    {promoterDetail.route.map((stop) => (
                      <div key={stop.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div><p className="text-sm font-black uppercase text-[#0F172A]">{stop.name}</p><p className="text-[9px] font-bold uppercase text-slate-400">{stop.date} às {stop.time} • {stop.photos} fotos</p></div>
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
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0F172A]">Gestão de Equipe</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">
            {activeFilterInfo.title}
          </p>
        </div>
        {filter !== 'all' && (
          <button 
            onClick={() => { setFilter('all'); setSearch(''); }}
            className="text-[10px] font-black uppercase tracking-widest text-[#E65C5C] hover:underline"
          >
            ← Voltar para Geral
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          onClick={() => selectFilter('active')}
          aria-pressed={filter === 'active'}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'active' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Users className="text-emerald-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Promotores Cadastrados</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.totalPromoters}</h4>
        </button>

        <button 
          onClick={() => selectFilter('offline')}
          aria-pressed={filter === 'offline'}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'offline' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
              <SignalLow className="text-slate-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sem Atualização Recente</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.offlinePromoters}</h4>
        </button>

        <button 
          onClick={() => selectFilter('sync_pending')}
          aria-pressed={filter === 'sync_pending'}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'sync_pending' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <ClipboardList className="text-red-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendências de Sync</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.pendingSyncPromoters}</h4>
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mt-1">{dashboard.summary.pendingSyncVisits} envio(s)</p>
        </button>

        <button 
          onClick={() => selectFilter('on_route')}
          aria-pressed={filter === 'on_route'}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'on_route' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Route className="text-blue-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Em Atividade Hoje</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.activeTodayPromoters}</h4>
        </button>

        <button 
          onClick={() => selectFilter('in_progress')}
          aria-pressed={filter === 'in_progress'}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'in_progress' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Play className="text-amber-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Envios em Processamento</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.inProgressPromoters}</h4>
        </button>

        <button 
          onClick={() => selectFilter('completed')}
          aria-pressed={filter === 'completed'}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'completed' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="text-emerald-700" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visitas Concluídas Hoje</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.completedVisits}</h4>
        </button>

        <button 
          onClick={() => selectFilter('pending')}
          aria-pressed={filter === 'pending'}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'pending' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <ClipboardList className="text-orange-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visitas Pendentes Hoje</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.pendingVisits}</h4>
        </button>

        <button
          onClick={() => selectFilter('duration')}
          aria-pressed={filter === 'duration'}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'duration' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
              <Clock className="text-slate-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Média de Tempo Hoje</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.averageVisitTime}</h4>
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-[28px] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-black text-[#E65C5C] uppercase tracking-[0.2em]">Indicador selecionado</p>
          <p className="text-sm font-black uppercase tracking-tight text-[#0F172A] mt-1">{activeFilterInfo.title}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{activeFilterInfo.description}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="text-right min-w-24">
            <p className="text-2xl font-black text-[#0F172A]">{filteredData.length}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Promotores no recorte</p>
          </div>
          <label className="relative block min-w-[240px]">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nome, telefone, loja ou região"
              className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-10 pr-4 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-[#E65C5C]"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div ref={resultsRef} tabIndex={-1} className="lg:col-span-2 space-y-4 scroll-mt-6 outline-none">
          <h3 aria-live="polite" className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
            {filter === 'all' && !search ? 'Desempenho dos Promotores' : `${activeFilterInfo.title} • ${filteredData.length} resultado${filteredData.length === 1 ? '' : 's'}`}
          </h3>
          {filteredData.length === 0 && (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-[#0F172A]">Nenhum promotor neste recorte</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-2">Altere o indicador ou limpe a busca para ampliar a análise.</p>
            </div>
          )}
          {filteredData.map(promoter => (
            <button 
              key={promoter.id} 
              onClick={() => handlePromoterClick(promoter)}
              className="w-full bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-[#E65C5C] transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center relative">
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${promoter.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="font-black text-xs text-slate-400">{promoter.name.split(' ').map((n:any) => n[0]).join('').slice(0,2)}</span>
                </div>
                <div>
                  <p className="font-black uppercase text-sm tracking-tight text-[#0F172A]">{promoter.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                      <MapPin size={10} /> {promoter.store}
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                      promoter.status === 'CONCLUÍDO' ? 'bg-emerald-50 text-emerald-600' : 
                      promoter.status === 'EM ANDAMENTO' ? 'bg-amber-50 text-amber-600' :
                      promoter.status === 'PENDENTE' ? 'bg-orange-50 text-orange-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {promoter.status}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right hidden md:block">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Visitas hoje</p>
                  <p className="text-sm font-black text-[#0F172A]">{promoter.todayVisits?.completed || 0} / {promoter.todayVisits?.total || 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[#0F172A]">{promoter.progress}%</p>
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#E65C5C] transition-all" style={{ width: `${promoter.progress}%` }} />
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Sinc: {promoter.lastSync}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-fit">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <TrendingUp className="text-[#E65C5C]" size={16}/> Curva de Execução Hoje
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="time" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#0F172A' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                <Line type="monotone" dataKey="totalVisits" name="Total" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="completedVisits" name="Concluídas" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="pendingSyncVisits" name="Pendências" stroke="#F59E0B" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total de Visitas</span>
              <span className="text-[10px] font-black text-blue-600">{dashboard.summary.totalVisits}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Concluídas</span>
              <span className="text-[10px] font-black text-emerald-600">{dashboard.summary.completedVisits}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pendências</span>
              <span className="text-[10px] font-black text-orange-500">{dashboard.summary.pendingSyncVisits}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
