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
import { LogOut, RefreshCw, AlertCircle, Loader2, CloudUpload, X, Settings } from 'lucide-react';
import { liteMode, litePilot, setLitePreference, isPhotoCaptureBusy } from './services/liteMode';
import { pruneConfirmedPhotos } from './services/litePhotos';
import { confirmQueuedVisit } from './services/confirmQueuedVisit';
import { appConfig } from './config/appConfig';
import { clearSession, getLastLoginUser, getSession, SESSION_EXPIRED_EVENT, type SessionEndReason } from './services/session';
import { HttpRequestError } from './services/httpClient';
import {
  getQueuedVisitCount,
  listQueuedVisitSummaries,
  updateQueuedVisit,
} from './services/syncQueue';
import { loadVisitDraft, requestPersistentVisitStorage, saveVisitDraft } from './services/visitStorage';
import { resolveSessionSection } from './services/navigationPolicy';
import { hasStartedVisit, recoverUnstartedVisit } from './services/visitLifecycle';
import { isStaleSync } from './services/syncAge';
import { deliverQueuedVisit, isQueuedVisitUploading } from './services/queuedVisitDelivery';
import { createSingleFlight } from './services/singleFlight';
import { auditLocalVisitPhotos, type LocalPhotoAudit } from './services/localPhotoAudit';
import { getQueuedVisit } from './services/syncQueue';

const INITIAL_STATE = {
  user: null, draftOwnerId: null, visitId: null, syncStatus: null, syncError: null, currentStore: '', currentStoreId: '', step: SectionId.Dashboard,
  checkInDone: false, checkInTime: null, checkOutTime: null,
  selectedIndustry: null, tasks: {}, photos: {}, stockQuantities: {}, 
  aiResults: {}, hasReturns: null, returnsPhotosByIndustry: {}, industryExecutions: {}, availableStores: [], industries: []
};

type PendingSyncView = {
  localOnly?: boolean;
  visitId: string;
  createdAt: string;
  store: string;
  status: string;
  error: string | null;
  sent: number;
  total: number;
  retry?: {
    retryable: boolean;
    available: boolean;
    remaining: number;
    retryAfterSeconds: number;
  };
};

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState(() => ({ user: getLastLoginUser(), pass: '' }));
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const loginRequestInFlight = useRef(false);
  const [visitState, setVisitState] = useState(() => {
    try {
      const session = getSession();
      if (session?.user) return { ...INITIAL_STATE, user: session.user, draftOwnerId: session.user.id };
    } catch (e) {
      console.error("Erro ao carregar estado do localStorage:", e);
    }
    return INITIAL_STATE;
  });

  const [activeSection, setActiveSection] = useState<SectionId>(() =>
    resolveSessionSection(visitState.user?.role, visitState.step, hasStartedVisit(visitState)),
  );

  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showPendingSyncPrompt, setShowPendingSyncPrompt] = useState(false);
  const [promptSyncing, setPromptSyncing] = useState(false);
  const [promptSyncMessage, setPromptSyncMessage] = useState('');
  const [promptSyncError, setPromptSyncError] = useState<string | null>(null);
  const [promptQueueCount, setPromptQueueCount] = useState(0);
  const [promptStaleCount, setPromptStaleCount] = useState(0);
  const [pendingSyncs, setPendingSyncs] = useState<PendingSyncView[]>([]);
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftRestoreFailed, setDraftRestoreFailed] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [deviceSettingBusy, setDeviceSettingBusy] = useState(false);
  const [deviceSettingError, setDeviceSettingError] = useState<string | null>(null);
  const persistenceAlertShown = useRef(false);
  const lastSessionRefresh = useRef(0);
  const automaticUploadBusy = useRef(false);
  const automaticUploadAttempts = useRef(new Map<string, number>());
  const statusChecks = useRef(createSingleFlight<void>());
  const [photoAudit, setPhotoAudit] = useState<{ ownerId: string; visitId: string; report?: LocalPhotoAudit; error?: string } | null>(null);
  const photoAuditBusy = useRef(false);

  const inspectSavedPhotos = async (visitId: string) => {
    const ownerId = getSession()?.user.id;
    if (!ownerId || photoAuditBusy.current) return;
    photoAuditBusy.current = true;
    setPhotoAudit({ ownerId, visitId });
    try {
      const queued = await getQueuedVisit(ownerId, visitId);
      if (!queued) throw new Error('O registro nao esta mais na fila local. Atualize o status.');
      const report = await auditLocalVisitPhotos(ownerId, queued.payload, () => getSession()?.user.id || null);
      if (getSession()?.user.id === ownerId) setPhotoAudit({ ownerId, visitId, report });
    } catch (error: any) {
      if (getSession()?.user.id === ownerId) setPhotoAudit({ ownerId, visitId, error: error.message || 'Nao foi possivel conferir as fotos.' });
    } finally { photoAuditBusy.current = false; }
  };

  useEffect(() => {
    const ownerId = visitState.user?.id;
    if (!ownerId || !draftHydrated || loading) return;
    let cancelled = false;
    const resumeAutomaticUploads = async () => {
      if (cancelled || automaticUploadBusy.current || !navigator.onLine || document.visibilityState === 'hidden') return;
      automaticUploadBusy.current = true;
      try {
        const summaries = await listQueuedVisitSummaries(ownerId);
        const pending = summaries.filter((item) => (item.status === 'pending' || item.status === 'syncing')
          && Date.now() - (automaticUploadAttempts.current.get(item.visitId) || 0) >= 60_000)
          .sort((left, right) => (automaticUploadAttempts.current.get(left.visitId) || 0) - (automaticUploadAttempts.current.get(right.visitId) || 0))
          .slice(0, 2);
        for (const summary of pending) {
          if (cancelled || !navigator.onLine) break;
          automaticUploadAttempts.current.set(summary.visitId, Date.now());
          try {
            if (isPhotoCaptureBusy()) break;
            await deliverQueuedVisit(ownerId, summary.visitId, {
              status: apiService.getSyncStatus, create: apiService.createVisit, start: apiService.startBackgroundSync,
            }, () => cancelled ? null : getSession()?.user.id || null);
          } catch (error) {
            if (cancelled || getSession()?.user.id !== ownerId) break;
          }
          window.dispatchEvent(new Event('criativa-sync-queue-updated'));
        }
      } catch (error) {
        console.error('Falha ao consultar encerramentos pendentes:', error);
      } finally {
        automaticUploadBusy.current = false;
      }
    };
    const resume = () => { void resumeAutomaticUploads(); };
    const timer = window.setInterval(resume, 60_000);
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('criativa-sync-queue-updated', resume);
    document.addEventListener('visibilitychange', resume);
    resume();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('online', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('criativa-sync-queue-updated', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [visitState.user?.id, draftHydrated, loading]);

  useEffect(() => {
    let cancelled = false;

    const restoreDraft = async () => {
      const session = getSession();
      // A signed-out screen must neither hydrate photo evidence nor replace it.
      if (!session?.user) {
        if (!cancelled) setDraftHydrated(true);
        return;
      }
      const saved = await loadVisitDraft(STORAGE_KEY, session.user.id);
      if (cancelled) return;

      if (saved) {
        const draftOwnerId = saved.draftOwnerId || saved.user?.id || null;
        const sessionMatchesDraft = !draftOwnerId || session?.user.id === draftOwnerId;
        const restored = sessionMatchesDraft ? recoverUnstartedVisit(saved) : null;
        setVisitState({
          ...INITIAL_STATE,
          ...(restored || {}),
          user: session?.user || null,
          draftOwnerId: sessionMatchesDraft ? draftOwnerId : session?.user.id || null,
        });
        setActiveSection(resolveSessionSection(
          session?.user.role,
          restored?.step || SectionId.Dashboard,
          Boolean(restored && hasStartedVisit(restored)),
        ));
      } else if (session?.user) {
        setActiveSection(resolveSessionSection(session.user.role));
      }

      await requestPersistentVisitStorage();
      if (!cancelled) setDraftHydrated(true);
    };

    restoreDraft().catch((error) => {
      console.error('Erro ao restaurar rascunho da visita:', error);
      if (!cancelled) { setDraftRestoreFailed(true); setDraftHydrated(true); }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = appConfig.title;
  }, []);

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const reason = (event as CustomEvent<SessionEndReason>).detail;
      setVisitState((prev: any) => ({
        ...prev,
        draftOwnerId: prev.draftOwnerId || prev.user?.id || null,
        user: null,
        step: activeSection,
      }));
      setLoadingError(null);
      setLoginError(reason === 'replaced'
        ? 'Este acesso foi encerrado porque a conta entrou em outro aparelho. Você pode entrar novamente neste aparelho.'
        : 'Sua sessão expirou. Entre novamente para continuar; o progresso salvo foi preservado.');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [activeSection]);

  const loadConfig = async (force = false, silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadingError(null);
    }
    try {
      const config = await apiService.getAppConfig(force);
      if (config) {
        setLastUpdate(config.timestamp);
        setVisitState((prev: any) => ({
          ...prev,
          industries: config.industries || []
        }));
        
        // If user is logged in, update stores from the network or its isolated offline cache.
        if (visitState.user) {
          const operationalData = await apiService.getOperationalData(
            visitState.user,
            config.industries || [],
          );
          setStores(operationalData.stores);
          setVisitState((prev: any) => ({
            ...prev,
            industries: operationalData.industries,
          }));
        }
      }
    } catch (e: any) {
      console.error("Erro ao atualizar dados:", e);
      if (e instanceof HttpRequestError && e.status === 401) {
        return;
      }
      if (!silent) {
        setLoadingError("Não foi possível carregar os dados. Verifique sua conexão ou tente novamente mais tarde.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!draftHydrated) return;
    loadConfig();
  }, [visitState.user?.id, draftHydrated]);

  useEffect(() => {
    if (!visitState.user?.id || !draftHydrated || loading) return;
    let cancelled = false;

    const renewSession = async (force = false) => {
      if (!navigator.onLine || document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (!force && now - lastSessionRefresh.current < 5 * 60 * 1000) return;
      lastSessionRefresh.current = now;

      try {
        const refreshedUser = await apiService.refreshSession();
        if (cancelled) return;
        setVisitState((prev: any) => ({ ...prev, user: refreshedUser }));
        if (!force) await loadConfig(false, true);
      } catch (error) {
        if (!(error instanceof HttpRequestError && error.status === 401)) {
          console.warn('Sessão não pôde ser renovada agora; o acesso local foi preservado.');
        }
      }
    };

    const handleResume = () => void renewSession();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleResume();
    };

    void renewSession(true);
    window.addEventListener('online', handleResume);
    window.addEventListener('pageshow', handleResume);
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleResume);
      window.removeEventListener('pageshow', handleResume);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [visitState.user?.id, draftHydrated, loading]);

  useEffect(() => {
    if (!draftHydrated || draftRestoreFailed || !visitState.user) return;

    saveVisitDraft(STORAGE_KEY, { ...visitState, step: activeSection }).catch((error) => {
      console.error('Erro ao persistir rascunho da visita:', error);
      if (!persistenceAlertShown.current) {
        persistenceAlertShown.current = true;
        alert('Não foi possível salvar o progresso neste aparelho. Verifique o espaço disponível antes de fechar o aplicativo.');
      }
    });
  }, [visitState, activeSection, draftHydrated, draftRestoreFailed]);

  useEffect(() => {
    if (loading || !visitState.user) return;
    let cancelled = false;
    const ownerId = visitState.user.id;

    setShowPendingSyncPrompt(false);
    setPromptQueueCount(0);
    setPromptStaleCount(0);
    setPromptSyncError(null);

    listQueuedVisitSummaries(ownerId).then((queuedVisits) => {
      if (cancelled) return;
      const queuedCount = queuedVisits.length;
      if (queuedCount > 0) {
        setPromptQueueCount(queuedCount);
        setPromptStaleCount(queuedVisits.filter((visit) => isStaleSync(visit.createdAt)).length);
        setPromptSyncMessage(`${queuedCount} envio${queuedCount > 1 ? 's' : ''} pendente${queuedCount > 1 ? 's' : ''} na fila local.`);
        setPromptSyncError(null);
        setShowPendingSyncPrompt(true);
      }
    }).catch((error) => console.error('Erro ao consultar fila local:', error));

    return () => {
      cancelled = true;
    };
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

  const refreshSyncStatus = () => {
    const ownerId = getSession()?.user.id;
    if (!ownerId) {
      setPendingSyncs([]);
      return Promise.resolve();
    }

    return statusChecks.current(ownerId, async () => {
    const queuedVisits = await listQueuedVisitSummaries(ownerId);
    const next: PendingSyncView[] = [];
    let queueChanged = false;

    for (const queuedVisit of queuedVisits) {
      if (getSession()?.user.id !== ownerId) return;
      try {
        const remote = await apiService.getSyncStatus(queuedVisit.visitId);
        if (getSession()?.user.id !== ownerId) return;
        if (remote.syncStatus === 'enviado') {
          await confirmQueuedVisit(ownerId, queuedVisit.visitId, remote.syncStatus);
          queueChanged = true;
          continue;
        }

        if (remote.syncStatus === 'erro' && queuedVisit.status !== 'error') {
          await updateQueuedVisit(ownerId, queuedVisit.visitId, {
            status: 'error',
            error: remote.syncError || 'Falha no envio em segundo plano.',
          });
          queueChanged = true;
        }

        next.push({
          visitId: queuedVisit.visitId,
          createdAt: queuedVisit.createdAt,
          store: queuedVisit.store,
          status: remote.syncStatus,
          error: remote.syncError || null,
          sent: Number(remote.progress?.sent || 0),
          total: Number(remote.progress?.total || 0),
          retry: remote.retry,
        });
      } catch (error: any) {
        const localOnly = error instanceof HttpRequestError && error.status === 404;
        next.push({
          visitId: queuedVisit.visitId,
          createdAt: queuedVisit.createdAt,
          store: queuedVisit.store,
          status: queuedVisit.status,
          localOnly,
          error: localOnly ? queuedVisit.error || 'Visita salva neste aparelho. O envio ao servidor ainda nao foi concluido.' : queuedVisit.error,
          sent: 0,
          total: 0,
        });
      }
    }

    if (getSession()?.user.id !== ownerId) return;
    setPendingSyncs(next);
    if (queueChanged) notifyQueueChanged();
    });
  };

  const retryPendingSync = async (sync: PendingSyncView) => {
    const ownerId = visitState.user?.id;
    if (!ownerId || (!sync.localOnly && !sync.retry?.available)) return;

    setPromptSyncError(null);
    setPendingSyncs((current) => current.map((item) => item.visitId === sync.visitId
      ? { ...item, status: 'enviando', error: null, retry: { ...item.retry!, available: false } }
      : item));

    try {
      if (sync.localOnly) {
        automaticUploadAttempts.current.set(sync.visitId, Date.now());
        await deliverQueuedVisit(ownerId, sync.visitId, {
          status: apiService.getSyncStatus, create: apiService.createVisit, start: apiService.startBackgroundSync,
        }, () => getSession()?.user.id || null);
        await refreshSyncStatus();
        notifyQueueChanged();
        return;
      }
      const result = await apiService.retrySync(sync.visitId);
      await updateQueuedVisit(ownerId, sync.visitId, { status: 'syncing', error: null });
      if (result.syncStatus === 'enviando') await apiService.startBackgroundSync(sync.visitId);
      await refreshSyncStatus();
      notifyQueueChanged();
    } catch (error: any) {
      if (!sync.localOnly && getSession()?.user.id === ownerId) await updateQueuedVisit(ownerId, sync.visitId, {
        status: 'error',
        error: error.message || 'Nao foi possivel tentar novamente.',
      });
      await refreshSyncStatus();
    }
  };

  const syncPendingQueueFromPrompt = async () => {
    const ownerId = visitState.user?.id;
    if (!ownerId) return;
    const queuedVisits = await listQueuedVisitSummaries(ownerId);
    if (queuedVisits.length === 0) {
      setShowPendingSyncPrompt(false);
      return;
    }

    setPromptSyncing(true);
    setPromptSyncError(null);

    try {
      for (let index = 0; index < queuedVisits.length; index += 1) {
        const queuedSummary = queuedVisits[index];
        setPromptSyncMessage(`Sincronizando ${index + 1}/${queuedVisits.length}...`);
        automaticUploadAttempts.current.set(queuedSummary.visitId, Date.now());
        await deliverQueuedVisit(ownerId, queuedSummary.visitId, {
          status: apiService.getSyncStatus, create: apiService.createVisit, start: apiService.startBackgroundSync,
        }, () => getSession()?.user.id || null);
      }

      notifyQueueChanged();
      setPromptSyncMessage('Envios iniciados em segundo plano. Você já pode continuar.');
      setTimeout(() => setShowPendingSyncPrompt(false), 1200);
    } catch (error: any) {
      setPromptSyncError(formatSyncError(error.message || 'Não foi possível sincronizar a fila agora.'));
      setPromptQueueCount(await getQueuedVisitCount(ownerId));
      notifyQueueChanged();
    } finally {
      setPromptSyncing(false);
    }
  };

  useEffect(() => {
    if (!visitState.user?.id || !draftHydrated || loading) return;

    const handleResume = () => {
      if (document.visibilityState !== 'hidden') void refreshSyncStatus();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleResume();
    };
    const intervalId = window.setInterval(handleResume, 15000);
    window.addEventListener('online', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('pageshow', handleResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('criativa-sync-queue-updated', handleResume);
    void refreshSyncStatus();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('pageshow', handleResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('criativa-sync-queue-updated', handleResume);
    };
  }, [visitState.user?.id, draftHydrated, loading]);

  useEffect(() => {
    const ownerId = visitState.user?.id;
    if (!ownerId || !draftHydrated || loading || hasStartedVisit(visitState)) return;
    let busy = false;
    const clean = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try { await pruneConfirmedPhotos(ownerId); }
      catch (error) { console.warn('Limpeza adiada; fotos locais preservadas.', error); }
      finally { busy = false; }
    };
    void clean();
    const timer = window.setInterval(clean, 60_000);
    return () => window.clearInterval(timer);
  }, [visitState.user?.id, draftHydrated, loading, visitState.visitId, visitState.checkInDone]);

  const changeDeviceMode = async () => {
    if (deviceSettingBusy || litePilot) return;
    setDeviceSettingBusy(true);
    setDeviceSettingError(null);
    try {
      const ownerId = visitState.user?.id;
      if (!ownerId || hasStartedVisit(visitState) || isPhotoCaptureBusy() || promptSyncing || automaticUploadBusy.current
        || await getQueuedVisitCount(ownerId) > 0) {
        setDeviceSettingError('Finalize a visita e confirme os envios pendentes antes de trocar o modo.');
        return;
      }
      await saveVisitDraft(STORAGE_KEY, { ...visitState, step: activeSection });
      setLitePreference(!liteMode);
      window.location.reload();
    } catch {
      setDeviceSettingError('Nao foi possivel trocar o modo. Os registros foram preservados.');
    } finally { setDeviceSettingBusy(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginRequestInFlight.current) return;

    loginRequestInFlight.current = true;
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      const userData = await apiService.login(loginForm);
      setLoginForm({ user: userData.user, pass: '' });
      const saved = visitState.draftOwnerId === userData.id ? visitState
        : await loadVisitDraft(STORAGE_KEY, userData.id);
      const restored = saved && (!saved.draftOwnerId || saved.draftOwnerId === userData.id)
        ? recoverUnstartedVisit(saved) : null;
      setVisitState({ ...INITIAL_STATE, ...(restored || {}), user: userData, draftOwnerId: userData.id });
      setActiveSection(resolveSessionSection(userData.role, restored?.step, Boolean(restored && hasStartedVisit(restored))));
    } catch (err: any) { 
      setLoginError(err.message);
    } finally {
      loginRequestInFlight.current = false;
      setLoginSubmitting(false);
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

  if (draftRestoreFailed) {
    return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center gap-5">
      <AlertCircle size={40} className="text-orange-600" />
      <h1 className="text-xl font-black">Não foi possível abrir os registros salvos</h1>
      <p className="max-w-sm text-slate-600">Seus dados foram preservados. Feche a câmera e outros aplicativos e tente novamente. Não limpe os dados do aplicativo.</p>
      <button className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold" onClick={() => window.location.reload()}>Tentar novamente</button>
    </div>;
  }

  if (loading || !draftHydrated) {
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
          <input disabled={loginSubmitting} type="text" value={loginForm.user} placeholder="Usuário" className="w-full p-5 bg-slate-50 rounded-2xl font-bold disabled:opacity-60" onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
          <input disabled={loginSubmitting} type="password" placeholder="Senha" className="w-full p-5 bg-slate-50 rounded-2xl font-bold disabled:opacity-60" onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
          <button disabled={loginSubmitting} type="submit" className="w-full bg-[#0F172A] text-white py-6 rounded-[28px] font-black uppercase tracking-widest disabled:opacity-60 disabled:cursor-wait">
            {loginSubmitting ? 'Acessando...' : 'Acessar'}
          </button>
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
              {promptStaleCount > 0 && (
                <p className="text-xs font-semibold text-orange-700">
                  {promptStaleCount} envio{promptStaleCount === 1 ? '' : 's'} há mais de 24 horas. Conecte-se e sincronize assim que possível.
                </p>
              )}
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

            <div className="flex flex-col gap-3">
              {!promptSyncError && (
                <button
                  disabled={promptSyncing}
                  onClick={syncPendingQueueFromPrompt}
                  className="flex-1 bg-[#E65C5C] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  {promptSyncing ? 'Sincronizando' : 'Sincronizar agora'}
                </button>
              )}
              {!promptSyncing && (
                <button
                  onClick={() => setShowPendingSyncPrompt(false)}
                  className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  Continuar trabalhando
                </button>
              )}
            </div>
            {!promptSyncing && (
              <p className="text-center text-[10px] font-bold text-slate-400">
                Os registros permanecem salvos e podem continuar enviando em segundo plano.
              </p>
            )}
          </div>
        </div>
      )}
      {showSyncStatus && (
        <div className="fixed inset-0 z-[85] bg-[#0F172A]/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white rounded-[36px] p-7 shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500">Sincronização</p>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-[#0F172A]">Envios pendentes</h2>
              </div>
              <button
                onClick={() => setShowSyncStatus(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                aria-label="Fechar status dos envios"
              >
                <X size={18} />
              </button>
            </div>

            {pendingSyncs.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CloudUpload size={28} />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Nenhum envio pendente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingSyncs.map((sync) => {
                  const percentage = sync.total > 0
                    ? Math.min(100, Math.round((sync.sent / sync.total) * 100))
                    : 0;
                  const hasError = sync.status === 'erro' || sync.status === 'error';
                  return (
                    <div key={sync.visitId} className="p-5 rounded-3xl border border-slate-100 bg-slate-50/70 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-black text-sm uppercase tracking-tight text-[#0F172A] truncate">{sync.store}</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 truncate">{sync.visitId}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-black ${hasError ? 'text-orange-600' : 'text-blue-600'}`}>
                          {percentage}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-white rounded-full overflow-hidden border border-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${hasError ? 'bg-orange-500' : 'bg-blue-500'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-widest">
                        <span className={hasError ? 'text-orange-600' : 'text-slate-500'}>
                          {hasError ? 'Erro no envio' : sync.localOnly ? 'Salvo no aparelho' : sync.total > 0 ? 'Enviando fotos' : 'Preparando envio'}
                        </span>
                        <span className="text-slate-400">{sync.sent}/{sync.total || '--'}</span>
                      </div>
                      {sync.error && <p className="text-[10px] font-bold text-orange-700 leading-relaxed">{sync.error}</p>}
                      {sync.localOnly && /foto local indisponivel|foto pertence/i.test(sync.error || '') && (
                        <div className="space-y-3">
                          <button type="button" onClick={() => void inspectSavedPhotos(sync.visitId)} disabled={photoAuditBusy.current}
                            className="w-full border border-slate-300 text-slate-700 py-3 rounded-xl font-bold text-xs disabled:opacity-50">
                            {photoAuditBusy.current && photoAudit?.visitId === sync.visitId ? 'Conferindo fotos...' : 'Verificar fotos salvas'}
                          </button>
                          {photoAudit?.ownerId === visitState.user?.id && photoAudit.visitId === sync.visitId && (
                            <div role="status" className="text-xs text-slate-700 space-y-2">
                              {photoAudit.report && <>
                                <p>Fotos com dados acessíveis: <strong>{photoAudit.report.readable}</strong></p>
                                <p>Imagens indisponíveis: <strong>{photoAudit.report.missing}</strong></p>
                                <p>Imagens diferentes no registro: {photoAudit.report.total}</p>
                                {photoAudit.report.differentOwner > 0 && <p>{photoAudit.report.differentOwner} referencias nao correspondem a esta conta.</p>}
                                {photoAudit.report.unverified > 0 && <p>{photoAudit.report.unverified} fotos nao puderam ser verificadas por falha de leitura.</p>}
                                <p>A conferência não altera fotos nem a fila. Informe estes números ao suporte.</p>
                              </>}
                              {photoAudit.error && <p>{photoAudit.error}</p>}
                              <p className="break-all text-slate-500">Endereço em uso: {window.location.hostname}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {isStaleSync(sync.createdAt) && (
                        <p className="text-[10px] font-bold text-orange-700">Pendente há mais de 24 horas. Sincronize com conexão estável.</p>
                      )}
                      {sync.localOnly && (
                        <button type="button" onClick={() => void retryPendingSync(sync)}
                          disabled={isQueuedVisitUploading(visitState.user!.id, sync.visitId)}
                          className="w-full bg-orange-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50">
                          {isQueuedVisitUploading(visitState.user!.id, sync.visitId) ? 'Enviando ao servidor...' : 'Enviar visita salva'}
                        </button>
                      )}
                      {!sync.localOnly && hasError && sync.retry?.retryable && (
                        <button
                          type="button"
                          disabled={!sync.retry.available}
                          onClick={() => void retryPendingSync(sync)}
                          className="w-full bg-orange-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          {sync.retry.remaining === 0
                            ? 'Necessita suporte'
                            : sync.retry.retryAfterSeconds > 0
                              ? `Aguarde ${sync.retry.retryAfterSeconds}s`
                              : 'Tentar novamente'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => void refreshSyncStatus()}
              className="w-full bg-[#0F172A] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]"
            >
              Atualizar status
            </button>
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
                 activeSection === SectionId.Dashboard ? 'Processo da Visita' :
                 activeSection === SectionId.Supervisor ? 'Gestão de Equipe' : 'Operação de Campo'}
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.16em] md:tracking-[0.2em] mt-0.5 truncate max-w-[48vw] md:max-w-none">
                {visitState.user?.role === 'SUPERVISOR' ? 'Supervisor' : 'Promotor'}: {visitState.user?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {visitState.user?.role === 'FIELD_OPS' && <button type="button" onClick={() => setShowDeviceSettings(true)}
              className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${liteMode ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}
              title="Preferencias do aparelho" aria-label="Preferencias do aparelho"><Settings size={18} /></button>}
            <div className="hidden md:block text-right mr-4">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Última Sincronização</p>
              <p className="text-[10px] font-bold text-slate-600">
                {lastUpdate ? new Date(lastUpdate).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--/-- --:--'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowSyncStatus(true);
                void refreshSyncStatus();
              }}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${pendingSyncs.some((sync) => sync.status === 'erro' || sync.status === 'error') ? 'bg-orange-50 text-orange-600' : pendingSyncs.length > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}
              aria-label={`Status dos envios: ${pendingSyncs.length} pendente${pendingSyncs.length === 1 ? '' : 's'}`}
              title="Status dos envios"
            >
              <CloudUpload size={18} />
              {pendingSyncs.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#E65C5C] text-white text-[9px] font-black flex items-center justify-center border-2 border-white">
                  {pendingSyncs.length > 9 ? '9+' : pendingSyncs.length}
                </span>
              )}
            </button>
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
                draftOwnerId: prev.user?.id || null,
                availableStores: stores,
                industries: prev.industries,
              }));
              setActiveSection(SectionId.CheckIn);
            }} 
          />
        </div>
      </main>
      {showDeviceSettings && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-5">
        <div role="dialog" aria-modal="true" aria-labelledby="device-settings-title" className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 id="device-settings-title" className="text-lg font-semibold">Preferencias do aparelho</h2>
            <button type="button" onClick={() => setShowDeviceSettings(false)} disabled={deviceSettingBusy} aria-label="Fechar preferencias" title="Fechar" className="p-2"><X size={18}/></button>
          </div>
          <label className="flex items-center justify-between gap-4 text-sm font-semibold">
            Modo Lite
            <input type="checkbox" checked={liteMode} disabled={deviceSettingBusy || litePilot} onChange={() => void changeDeviceMode()} className="h-5 w-5" />
          </label>
          {deviceSettingError && <p role="alert" className="mt-4 text-sm text-orange-700">{deviceSettingError}</p>}
        </div>
      </div>}
    </div>
  );
};

export default App;
