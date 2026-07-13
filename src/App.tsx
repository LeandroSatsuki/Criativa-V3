/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import CriativaIcon from './components/CriativaIcon';
import { SectionId, STORAGE_KEY } from './types';
import { apiService } from './services/apiService';
import { LogOut, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { appConfig } from './config/appConfig';
import { clearSession, getLastLoginUser, getSession } from './services/session';
import { getQueuedVisitCount, listQueuedVisits, removeQueuedVisit, updateQueuedVisit } from './services/syncQueue';
import { loadVisitDraft, readLegacyVisitState, requestPersistentVisitStorage, saveVisitDraft } from './services/visitStorage';

const INITIAL_STATE = {
  user: null, draftOwnerId: null, visitId: null, syncStatus: null, syncError: null, currentStore: '', currentStoreId: '', step: SectionId.Dashboard,
  checkInDone: false, checkInTime: null, checkOutTime: null,
  selectedIndustry: null, tasks: {}, photos: {}, stockQuantities: {}, 
  aiResults: {}, hasReturns: null, industryExecutions: {}, availableStores: [], industries: []
};

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState(() => ({ user: getLastLoginUser(), pass: '' }));
  const [visitState, setVisitState] = useState(() => {
    try {
      const saved = readLegacyVisitState(STORAGE_KEY);
      const session = getSession();
      if (saved) {
        const draftOwnerId = saved.draftOwnerId || saved.user?.id || null;
        const sessionMatchesDraft = !draftOwnerId || session?.user.id === draftOwnerId;
        return {
          ...INITIAL_STATE,
          ...(sessionMatchesDraft ? saved : {}),
          user: session?.user || null,
          draftOwnerId: sessionMatchesDraft ? draftOwnerId : session?.user.id || null,
        };
      }
      if (session?.user) return { ...INITIAL_STATE, user: session.user, draftOwnerId: session.user.id };
    } catch (e) {
      console.error("Erro ao carregar estado do localStorage:", e);
    }
    return INITIAL_STATE;
  });

  const [activeSection, setActiveSection] = useState<SectionId>(visitState.step || SectionId.Dashboard);

  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showPendingSyncPrompt, setShowPendingSyncPrompt] = useState(false);
  const [promptSyncing, setPromptSyncing] = useState(false);
  const [promptSyncMessage, setPromptSyncMessage] = useState('');
  const [promptSyncError, setPromptSyncError] = useState<string | null>(null);
  const [promptQueueCount, setPromptQueueCount] = useState(0);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const persistenceAlertShown = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const restoreDraft = async () => {
      const saved = await loadVisitDraft(STORAGE_KEY);
      if (cancelled) return;

      const session = getSession();
      if (saved) {
        const draftOwnerId = saved.draftOwnerId || saved.user?.id || null;
        const sessionMatchesDraft = !draftOwnerId || session?.user.id === draftOwnerId;
        const restored = sessionMatchesDraft ? saved : {};
        setVisitState({
          ...INITIAL_STATE,
          ...restored,
          user: session?.user || null,
          draftOwnerId: sessionMatchesDraft ? draftOwnerId : session?.user.id || null,
        });
        setActiveSection(sessionMatchesDraft && saved.step ? saved.step : SectionId.Dashboard);
      }

      await requestPersistentVisitStorage();
      if (!cancelled) setDraftHydrated(true);
    };

    restoreDraft().catch((error) => {
      console.error('Erro ao restaurar rascunho da visita:', error);
      if (!cancelled) setDraftHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
      const message = String(e?.message || '');
      if (message.includes('Sessão expirada') || message.includes('Não autorizado')) {
        clearSession();
        setVisitState((prev: any) => ({
          ...prev,
          draftOwnerId: prev.draftOwnerId || prev.user?.id || null,
          user: null,
          step: activeSection,
        }));
        setLoadingError(null);
        return;
      }
      setLoadingError("Não foi possível carregar os dados. Verifique sua conexão ou tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [visitState.user?.id]);

  useEffect(() => {
    if (!draftHydrated) return;

    saveVisitDraft(STORAGE_KEY, { ...visitState, step: activeSection }).catch((error) => {
      console.error('Erro ao persistir rascunho da visita:', error);
      if (!persistenceAlertShown.current) {
        persistenceAlertShown.current = true;
        alert('Não foi possível salvar o progresso neste aparelho. Verifique o espaço disponível antes de fechar o aplicativo.');
      }
    });
  }, [visitState, activeSection, draftHydrated]);

  useEffect(() => {
    if (loading || !visitState.user) return;

    getQueuedVisitCount().then((queuedCount) => {
      if (queuedCount > 0) {
        setPromptQueueCount(queuedCount);
        setPromptSyncMessage(`${queuedCount} envio${queuedCount > 1 ? 's' : ''} pendente${queuedCount > 1 ? 's' : ''} na fila local.`);
        setPromptSyncError(null);
        setShowPendingSyncPrompt(true);
      }
    }).catch((error) => console.error('Erro ao consultar fila local:', error));
  }, [loading, visitState.user?.id]);

  const formatSyncError = (message: string) => {
    if (/make retornou http 500/i.test(message) || /scenario failed to initialize/i.test(message)) {
      return 'A integração Make não inicializou o cenário. A visita continua salva para reenvio.';
    }

    return message;
  };

  const notifyQueueChanged = () => {
    window.dispatchEvent(new Event('criativa-sync-queue-updated'));
  };

  const syncPendingQueueFromPrompt = async () => {
    const queuedVisits = await listQueuedVisits();
    if (queuedVisits.length === 0) {
      setShowPendingSyncPrompt(false);
      return;
    }

    setPromptSyncing(true);
    setPromptSyncError(null);

    try {
      for (let index = 0; index < queuedVisits.length; index += 1) {
        const queuedVisit = queuedVisits[index];
        setPromptSyncMessage(`Sincronizando ${index + 1}/${queuedVisits.length}...`);
        await updateQueuedVisit(queuedVisit.visitId, {
          status: 'syncing',
          error: null,
        });

        const draft = await apiService.createVisit({ ...queuedVisit.payload, visitId: queuedVisit.visitId });
        const serverVisitId = draft.visitId || queuedVisit.visitId;
        const result = await apiService.retrySync(serverVisitId);

        if (result.syncStatus === 'enviado') {
          await removeQueuedVisit(serverVisitId);
          if (serverVisitId !== queuedVisit.visitId) {
            await removeQueuedVisit(queuedVisit.visitId);
          }
          notifyQueueChanged();
          continue;
        }

        await updateQueuedVisit(serverVisitId, {
          status: 'error',
          error: result.syncError || 'Falha na sincronização',
          attempts: queuedVisit.attempts + 1,
        });
        throw new Error(result.syncError || 'Falha na sincronização');
      }

      notifyQueueChanged();
      setPromptSyncMessage('Fila sincronizada com sucesso.');
      setTimeout(() => setShowPendingSyncPrompt(false), 1200);
    } catch (error: any) {
      setPromptSyncError(formatSyncError(error.message || 'Não foi possível sincronizar a fila agora.'));
      setPromptQueueCount(await getQueuedVisitCount());
      notifyQueueChanged();
    } finally {
      setPromptSyncing(false);
    }
  };

  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const userData = await apiService.login(loginForm);
      const sameDraftOwner = !visitState.draftOwnerId || visitState.draftOwnerId === userData.id;
      const hasActiveVisit = sameDraftOwner && Boolean(visitState.visitId || visitState.checkInDone || visitState.currentStoreId);
      setVisitState((prev: any) => sameDraftOwner
        ? { ...prev, user: userData, draftOwnerId: userData.id }
        : { ...INITIAL_STATE, user: userData, draftOwnerId: userData.id });
      setActiveSection(
        userData.role === 'SUPERVISOR'
          ? SectionId.Supervisor
          : hasActiveVisit
            ? (visitState.step || SectionId.Dashboard)
            : SectionId.CheckIn,
      );
    } catch (err: any) { 
      setLoginError(err.message);
    }
  };

  const logout = () => {
    clearSession();
    setVisitState((prev: any) => ({
      ...prev,
      draftOwnerId: prev.draftOwnerId || prev.user?.id || null,
      user: null,
      step: activeSection,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-white p-6 text-center">
        <RefreshCw className="w-12 h-12 mb-6 animate-spin text-blue-400" />
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Carregando Dados...</h1>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest max-w-xs">
          Buscando informações do backend seguro.
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
      {showPendingSyncPrompt && (
        <div className="fixed inset-0 z-[80] bg-[#0F172A]/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-[36px] p-8 shadow-2xl border border-slate-100 space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center">
                {promptSyncing ? <Loader2 className="animate-spin" size={28} /> : <RefreshCw size={28} />}
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-[#0F172A]">Envios pendentes</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Existem {promptQueueCount} registro{promptQueueCount !== 1 ? 's' : ''} aguardando sincronização.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${promptSyncing ? 'w-2/3 bg-blue-500 animate-pulse' : promptSyncError ? 'w-1/3 bg-orange-500' : 'w-1/4 bg-emerald-500'}`} />
              </div>
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                {promptSyncMessage}
              </p>
            </div>

            {promptSyncError && (
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-start gap-3 text-orange-700">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-xs font-bold uppercase tracking-tight">{promptSyncError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {!promptSyncError && (
                <button
                  disabled={promptSyncing}
                  onClick={syncPendingQueueFromPrompt}
                  className="flex-1 bg-[#E65C5C] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  {promptSyncing ? 'Sincronizando' : 'Sincronizar agora'}
                </button>
              )}
              {promptSyncError && (
                <button
                  disabled={promptSyncing}
                  onClick={() => setShowPendingSyncPrompt(false)}
                  className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  Depois
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <Sidebar activeSection={activeSection} onSelect={(id) => setActiveSection(id as SectionId)} onLogout={logout} tasksCompleted={visitState.tasks} isCheckInDone={visitState.checkInDone} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={visitState.user} />
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen">
        <header className="h-20 px-4 md:px-8 flex items-center justify-between gap-3 bg-white border-b border-slate-100 sticky top-0 z-40">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-white rounded-xl shadow-md shadow-slate-200/50 flex items-center justify-center border border-slate-50 shrink-0">
              <CriativaIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-base md:text-lg uppercase tracking-tight text-[#0F172A] truncate">
                {activeSection === SectionId.CheckIn ? 'Seleção de Unidade' : 
                 activeSection === SectionId.Dashboard ? 'Painel Geral' : 
                 activeSection === SectionId.Supervisor ? 'Gestão de Equipe' : 'Operação de Campo'}
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.16em] md:tracking-[0.2em] mt-0.5 truncate max-w-[48vw] md:max-w-none">
                {visitState.user?.role === 'SUPERVISOR' ? 'Supervisor' : 'Promotor'}: {visitState.user?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:block text-right mr-4">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Última Sincronização</p>
              <p className="text-[10px] font-bold text-slate-600">
                {lastUpdate ? new Date(lastUpdate).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--/-- --:--'}
              </p>
            </div>
            <button 
              onClick={() => loadConfig(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-50 text-blue-600 font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all shadow-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Atualizar Agora</span>
            </button>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-3 md:px-5 py-2.5 bg-[#FDECEC] text-[#E65C5C] font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-[#FAD7D7] transition-all shadow-sm"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sair da Conta</span>
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
