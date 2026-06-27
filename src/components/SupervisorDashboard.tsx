import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Users, Clock, MapPin, CheckCircle2, Loader2, Route, Play, ClipboardList, SignalLow } from 'lucide-react';
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
  inProgressPromoters: 0,
  completedPromoters: 0,
  pendingPromoters: 0,
  pendingSyncVisits: 0,
  totalVisits: 0,
  completedVisits: 0,
  averageVisitTime: '--:--',
  lastUpdated: '',
};

const EMPTY_DASHBOARD: SupervisorDashboardResponse = {
  summary: EMPTY_SUMMARY,
  timeline: EMPTY_TIMELINE,
  promoters: [],
  lastUpdated: '',
};

const SupervisorDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<SupervisorDashboardResponse>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'sync_pending' | 'on_route' | 'in_progress' | 'pending' | 'offline'>('all');
  const [selectedPromoter, setSelectedPromoter] = useState<SupervisorPromoterOverview | null>(null);
  const [promoterDetail, setPromoterDetail] = useState<SupervisorPromoterDetailResponse | null>(null);

  useEffect(() => { 
    apiService.getSupervisorDashboard()
      .then(res => {
        setDashboard(res);
        setError(null);
      })
      .catch((fetchError: any) => {
        setDashboard(EMPTY_DASHBOARD);
        setError(fetchError?.message || 'Não foi possível carregar o painel do supervisor.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePromoterClick = async (promoter: SupervisorPromoterOverview) => {
    setSelectedPromoter(null);
    setPromoterDetail(null);
    setLoading(true);
    try {
      const detail = await apiService.getPromoterExecution(promoter.id);
      setPromoterDetail(detail);
      setSelectedPromoter(promoter);
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = dashboard.promoters.filter(p => {
    if (filter === 'active') return p.online;
    if (filter === 'completed') return p.status === 'CONCLUÍDO';
    if (filter === 'sync_pending') return p.pendingSyncVisits > 0;
    if (filter === 'on_route') return p.status === 'EM ROTA';
    if (filter === 'in_progress') return p.status === 'EM ANDAMENTO';
    if (filter === 'pending') return p.status === 'PENDENTE';
    if (filter === 'offline') return !p.online;
    return true;
  });

  const chartData = dashboard.timeline;

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

  // Detailed View for a Single Promoter
  if (selectedPromoter && promoterDetail) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => { setSelectedPromoter(null); setPromoterDetail(null); }}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#E65C5C] transition-colors"
          >
            ← Voltar para Gestão
          </button>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Atual</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              selectedPromoter.online ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'
            }`}>
              {selectedPromoter.online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center text-2xl font-black text-slate-400">
            {selectedPromoter.name.split(' ').map((n:any) => n[0]).join('').slice(0,2)}
          </div>
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0F172A]">{selectedPromoter.name}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {selectedPromoter.id} • Regional: {selectedPromoter.region || 'ES'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Eficiência</p>
            <h4 className="text-3xl font-black text-emerald-600">{promoterDetail.metrics.efficiency}</h4>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tempo de Jornada</p>
            <h4 className="text-3xl font-black text-[#0F172A]">{promoterDetail.metrics.workingTime}</h4>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Progresso Total</p>
            <h4 className="text-3xl font-black text-[#E65C5C]">{selectedPromoter.progress}%</h4>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Roteiro e Execução</h3>
          <div className="space-y-3">
            {promoterDetail.route.map((stop: any) => (
              <div key={stop.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    stop.status === 'CONCLUÍDO' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {stop.status === 'CONCLUÍDO' ? <CheckCircle2 size={20} /> : <Play size={20} />}
                  </div>
                  <div>
                    <p className="font-black uppercase text-sm text-[#0F172A]">{stop.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{stop.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Tarefas</p>
                    <p className="text-xs font-black text-[#0F172A]">{stop.tasks}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Fotos</p>
                    <p className="text-xs font-black text-[#0F172A]">{stop.photos}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                    stop.status === 'CONCLUÍDO' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {stop.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0F172A]">Gestão de Equipe</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">
            {filter === 'all' ? 'Visão Geral' : filter === 'active' ? 'Promotores Ativos' : 'Visitas Concluídas'}
          </p>
        </div>
        {filter !== 'all' && (
          <button 
            onClick={() => setFilter('all')}
            className="text-[10px] font-black uppercase tracking-widest text-[#E65C5C] hover:underline"
          >
            ← Voltar para Geral
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          onClick={() => setFilter('active')}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'active' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Users className="text-emerald-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Promotores Ativos</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.onlinePromoters}</h4>
        </button>

        <button 
          onClick={() => setFilter('offline')}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'offline' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
              <SignalLow className="text-slate-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Promotores Off Line</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.offlinePromoters}</h4>
        </button>

        <button 
          onClick={() => setFilter('sync_pending')}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'sync_pending' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <ClipboardList className="text-red-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendências de Sync</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.pendingSyncVisits}</h4>
        </button>

        <button 
          onClick={() => setFilter('on_route')}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'on_route' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Route className="text-blue-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Promotores em Rota</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.onRoutePromoters}</h4>
        </button>

        <button 
          onClick={() => setFilter('in_progress')}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'in_progress' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Play className="text-amber-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visitas em Andamento</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.inProgressPromoters}</h4>
        </button>

        <button 
          onClick={() => setFilter('completed')}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'completed' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="text-emerald-700" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visitas Concluídas</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.completedPromoters}</h4>
        </button>

        <button 
          onClick={() => setFilter('pending')}
          className={`text-left transition-all hover:scale-[1.02] active:scale-95 ${filter === 'pending' ? 'ring-2 ring-[#E65C5C]' : ''} bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <ClipboardList className="text-orange-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visitas Pendentes</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.pendingPromoters}</h4>
        </button>

        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
              <Clock className="text-slate-600" size={16} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Média de Tempo</p>
          </div>
          <h4 className="text-2xl font-black text-[#0F172A]">{dashboard.summary.averageVisitTime}</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
            {filter === 'all' ? 'Desempenho dos Promotores' : 'Filtro Ativo'}
          </h3>
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
                      promoter.status === 'EM ROTA' ? 'bg-blue-50 text-blue-600' :
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
                  <p className="text-[9px] font-black text-slate-400 uppercase">Visitas</p>
                  <p className="text-sm font-black text-[#0F172A]">{promoter.visits?.completed || 0} / {promoter.visits?.total || 0}</p>
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
            <TrendingUp className="text-[#E65C5C]" size={16}/> Curva de Execução
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
