/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import CriativaIcon from './components/CriativaIcon';
import { SectionId, STORAGE_KEY } from './types';
import { apiService } from './services/apiService';
import { LogOut, RefreshCw, AlertCircle } from 'lucide-react';
import { appConfig } from './config/appConfig';

const INITIAL_STATE = {
  user: null, currentStore: '', currentStoreId: '', step: SectionId.Dashboard,
  checkInDone: false, checkInTime: null, checkOutTime: null,
  selectedIndustry: null, tasks: {}, photos: {}, stockQuantities: {}, 
  aiResults: {}, hasReturns: null, availableStores: [], industries: []
};

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [visitState, setVisitState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_STATE, ...parsed };
      }
    } catch (e) {
      console.error("Erro ao carregar estado do localStorage:", e);
      localStorage.removeItem(STORAGE_KEY);
    }
    return INITIAL_STATE;
  });

  const [activeSection, setActiveSection] = useState<SectionId>(visitState.step || SectionId.Dashboard);

  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    document.title = appConfig.title;
  }, []);

  const loadConfig = async (force = false) => {
    setLoading(true);
    setLoadingError(null);
    try {
      const config = await apiService.getAppConfig(force);
      if (config) {
        setLastUpdate(config.timestamp);
        setVisitState((prev: any) => ({
          ...prev,
          industries: config.industries || []
        }));
        
        // If user is logged in, update stores from the new config
        if (visitState.user) {
          const data = await apiService.getStores(visitState.user.id);
          setStores(data);
        }
      }
    } catch (e: any) {
      console.error("Erro ao atualizar dados:", e);
      setLoadingError("Não foi possível carregar os dados. Verifique sua conexão ou tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [visitState.user?.id]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...visitState, step: activeSection }));
  }, [visitState, activeSection]);

  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const userData = await apiService.login(loginForm);
      setVisitState((prev: any) => ({ ...prev, user: userData }));
      setActiveSection(userData.role === 'SUPERVISOR' ? SectionId.Supervisor : SectionId.CheckIn);
    } catch (err: any) { 
      setLoginError(err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setVisitState(INITIAL_STATE);
    setActiveSection(SectionId.Dashboard);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-white p-6 text-center">
        <RefreshCw className="w-12 h-12 mb-6 animate-spin text-blue-400" />
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Carregando Dados...</h1>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest max-w-xs">
          Buscando informações da planilha do Google.
        </p>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-4">
          Limite de espera: 60 segundos
        </p>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <RefreshCw className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Erro de Conexão</h1>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-8 max-w-xs">
          {loadingError}
        </p>
        <button 
          onClick={() => loadConfig(true)}
          className="bg-white text-[#0F172A] px-10 py-5 rounded-[28px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!visitState.user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-white p-10 rounded-[48px] shadow-2xl space-y-6">
          <div className="text-center">
            <CriativaIcon className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-black uppercase tracking-tighter">Criativa</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Operação Campo</p>
          </div>
          {loginError && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 animate-in">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-xs font-bold uppercase tracking-tight">{loginError}</p>
            </div>
          )}
          <input type="text" placeholder="Usuário" className="w-full p-5 bg-slate-50 rounded-2xl font-bold" onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
          <input type="password" placeholder="Senha" className="w-full p-5 bg-slate-50 rounded-2xl font-bold" onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
          <button type="submit" className="w-full bg-[#0F172A] text-white py-6 rounded-[28px] font-black uppercase tracking-widest">Acessar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row">
      <Sidebar activeSection={activeSection} onSelect={(id) => setActiveSection(id as SectionId)} onLogout={logout} tasksCompleted={visitState.tasks} isCheckInDone={visitState.checkInDone} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={visitState.user} />
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen">
        <header className="h-20 px-8 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl shadow-md shadow-slate-200/50 flex items-center justify-center border border-slate-50">
              <CriativaIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-lg uppercase tracking-tight text-[#0F172A]">
                {activeSection === SectionId.CheckIn ? 'Seleção de Unidade' : 
                 activeSection === SectionId.Dashboard ? 'Painel Geral' : 
                 activeSection === SectionId.Supervisor ? 'Gestão de Equipe' : 'Operação de Campo'}
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                {visitState.user?.role === 'SUPERVISOR' ? 'Supervisor' : 'Promotor'}: {visitState.user?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block text-right mr-4">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Última Sincronização</p>
              <p className="text-[10px] font-bold text-slate-600">
                {lastUpdate ? new Date(lastUpdate).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--/-- --:--'}
              </p>
            </div>
            <button 
              onClick={() => loadConfig(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all shadow-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar Agora
            </button>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FDECEC] text-[#E65C5C] font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-[#FAD7D7] transition-all shadow-sm"
            >
              <LogOut size={14} />
              Sair da Conta
            </button>
          </div>
        </header>
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <ContentArea 
            sectionId={activeSection} 
            visitState={{...visitState, availableStores: stores}} 
            updateVisit={(k, v) => setVisitState((p:any) => {
              const newValue = typeof v === 'function' ? v(p[k]) : v;
              return {...p, [k]: newValue};
            })} 
            navigateTo={(id) => setActiveSection(id as SectionId)} 
            onReset={() => {
              setVisitState((prev: any) => ({
                ...INITIAL_STATE,
                user: prev.user,
                availableStores: stores
              }));
              setActiveSection(SectionId.Dashboard);
            }} 
          />
        </div>
      </main>
    </div>
  );
};

export default App;
