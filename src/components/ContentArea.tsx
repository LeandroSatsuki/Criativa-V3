/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SectionId, VisitState, Industry, IndustryExecution } from '../types';
import { apiService, getBrasiliaISO } from '../services/apiService';
import { analyzeProductPhoto } from '../services/geminiService';
import { getQueuedVisitCount, listQueuedVisits, removeQueuedVisit, upsertQueuedVisit, updateQueuedVisit } from '../services/syncQueue';
import { generateVisitId } from '../services/visitId';
import SupervisorDashboard from './SupervisorDashboard';
import CriativaIcon from './CriativaIcon';
import { 
  MapPin, 
  Camera, 
  Boxes, 
  CheckCircle2, 
  PackageOpen, 
  Send, 
  CloudUpload, 
  AlertCircle, 
  Loader2,
  ArrowLeft,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContentAreaProps {
  sectionId: SectionId;
  visitState: VisitState;
  updateVisit: (key: string, value: any) => void;
  navigateTo: (id: SectionId) => void;
  onReset: () => void;
}

const MAX_PHOTOS_PER_SECTION = 30;

const ContentArea: React.FC<ContentAreaProps> = ({ 
  sectionId, 
  visitState, 
  updateVisit, 
  navigateTo, 
  onReset 
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Enviando dados para o servidor central');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [stockIndustry, setStockIndustry] = useState('');

  React.useEffect(() => {
    const refreshQueue = () => {
      getQueuedVisitCount()
        .then(setQueueCount)
        .catch((error) => console.error('Erro ao consultar fila local:', error));
    };
    void refreshQueue();
    window.addEventListener('storage', refreshQueue);
    window.addEventListener('criativa-sync-queue-updated', refreshQueue);
    return () => {
      window.removeEventListener('storage', refreshQueue);
      window.removeEventListener('criativa-sync-queue-updated', refreshQueue);
    };
  }, []);

  React.useEffect(() => {
    if (sectionId !== SectionId.Sync) return;
    setSyncSuccess(false);
    setSyncError(null);
    setIsSyncing(false);
    setSyncMessage('Enviando dados para o servidor central');
    getQueuedVisitCount().then(setQueueCount).catch((error) => console.error('Erro ao consultar fila local:', error));
  }, [sectionId]);

  const handleCheckIn = (store: any) => {
    if (!visitState.visitId) {
      updateVisit('visitId', generateVisitId());
    }
    updateVisit('currentStore', store.name);
    updateVisit('currentStoreId', store.id);
    updateVisit('checkInTime', getBrasiliaISO());
    navigateTo(SectionId.Facade);
  };

  const photos = visitState.photos || {};
  const tasks = visitState.tasks || {};
  const stockQuantities = visitState.stockQuantities || {};
  const selectedIndustry = visitState.selectedIndustry || '';
  const industryExecutions = visitState.industryExecutions || {};
  const returnsPhotosByIndustry = visitState.returnsPhotosByIndustry || {};
  const openedIndustryExecutions = Object.values(industryExecutions);
  const selectedExecution = selectedIndustry ? industryExecutions[selectedIndustry] : null;
  const currentStockQuantity = stockIndustry
    ? String(stockQuantities[stockIndustry] ?? industryExecutions[stockIndustry]?.stockQuantities?.[stockIndustry] ?? '').trim()
    : '';
  const isCurrentStockQuantityValid = /^\d+$/.test(currentStockQuantity);
  const industryStepIds = [SectionId.Antes, SectionId.Estoque, SectionId.Depois, SectionId.Trocas];
  const flowStepIds = [SectionId.Antes, SectionId.Depois, SectionId.Trocas];

  const createIndustryExecution = (industry: string, existing?: Partial<IndustryExecution>): IndustryExecution => ({
    industry,
    status: existing?.status || 'aberto',
    tasks: existing?.tasks || {},
    photos: existing?.photos || {},
    stockQuantities: existing?.stockQuantities || {},
    aiResults: existing?.aiResults || {},
    hasReturns: existing?.hasReturns ?? null,
    openedAt: existing?.openedAt || getBrasiliaISO(),
    completedAt: existing?.completedAt || null,
  });

  const isIndustryStep = (section: string) => industryStepIds.includes(section as SectionId);
  const hasIndustryActivity = (execution?: Partial<IndustryExecution> | null) => (
    flowStepIds.some((section) => (execution?.photos?.[section]?.length || 0) > 0)
    || execution?.hasReturns !== null
    || flowStepIds.some((section) => Boolean(execution?.tasks?.[section]))
  );
  const hasStepEvidence = (execution: Partial<IndustryExecution> | null | undefined, section: SectionId) => Boolean(
    execution?.tasks?.[section] || (execution?.photos?.[section]?.length || 0) > 0
  );
  const hasReturnsEvidence = (execution?: Partial<IndustryExecution> | null) => (
    Boolean(execution?.tasks?.[SectionId.Trocas])
    || execution?.hasReturns === false
    || (execution?.hasReturns === true && (execution.photos?.[SectionId.Trocas]?.length || 0) > 0)
  );
  const isExecutionComplete = (execution?: Partial<IndustryExecution> | null) => Boolean(
    hasStepEvidence(execution, SectionId.Antes)
    && hasStepEvidence(execution, SectionId.Depois)
    && hasReturnsEvidence(execution)
  );

  const getExecutionWithStatus = (execution: IndustryExecution): IndustryExecution => {
    const complete = isExecutionComplete(execution);
    return {
      ...execution,
      status: complete ? 'concluido' : 'aberto',
      completedAt: complete ? (execution.completedAt || getBrasiliaISO()) : null,
    };
  };

  const openIndustryExecution = (industry: string) => {
    updateVisit('selectedIndustry', industry);
  };

  const updateSelectedExecution = (updater: (execution: IndustryExecution) => IndustryExecution) => {
    if (!selectedIndustry) return;
    updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
      const current = createIndustryExecution(selectedIndustry, prev[selectedIndustry]);
      const updated = getExecutionWithStatus(updater(current));
      if (!hasIndustryActivity(updated)) {
        const next = { ...prev };
        delete next[selectedIndustry];
        return next;
      }
      return {
        ...prev,
        [selectedIndustry]: updated,
      };
    });
  };

  const getIndustryPhotos = (section: SectionId) => {
    if (!selectedIndustry) return [];
    if (section === SectionId.Trocas && Object.prototype.hasOwnProperty.call(returnsPhotosByIndustry, selectedIndustry)) {
      return returnsPhotosByIndustry[selectedIndustry] || [];
    }
    return selectedExecution?.photos?.[section] || photos[section] || [];
  };

  const selectedTasks = selectedExecution?.tasks || {};
  const selectedAntesComplete = hasStepEvidence(selectedExecution, SectionId.Antes);
  const stockComplete = Boolean(tasks[SectionId.Estoque])
    || Object.values(stockQuantities).some((value) => String(value || '').trim() !== '')
    || Object.values(industryExecutions).some((execution) => hasStepEvidence(execution, SectionId.Estoque));
  const selectedDepoisComplete = hasStepEvidence(selectedExecution, SectionId.Depois);
  const activeIndustryExecutions = openedIndustryExecutions.filter(hasIndustryActivity);
  const beforeOpenedIndustryExecutions = activeIndustryExecutions.filter((execution) => (
    (execution.photos?.[SectionId.Antes]?.length || 0) > 0
    || Boolean(execution.tasks?.[SectionId.Antes])
  ));
  const afterIndustryExecutions = beforeOpenedIndustryExecutions.length > 0
    ? beforeOpenedIndustryExecutions
    : activeIndustryExecutions;
  const returnsStepComplete = afterIndustryExecutions.length > 0
    ? afterIndustryExecutions.every(hasReturnsEvidence)
    : Boolean(tasks[SectionId.Trocas]);
  const pendingIndustryExecutions = activeIndustryExecutions.filter(execution => !isExecutionComplete(execution));
  const legacyFlowComplete = openedIndustryExecutions.length === 0
    && Boolean(tasks[SectionId.Antes] && tasks[SectionId.Depois] && tasks[SectionId.Trocas]);
  const canCheckOut = legacyFlowComplete || (activeIndustryExecutions.length > 0 && pendingIndustryExecutions.length === 0);
  const totalIndustryPhotos = activeIndustryExecutions.reduce((total, execution) => (
    total + Object.values(execution.photos || {}).flat().length
  ), 0);
  const activeIndustryNames = activeIndustryExecutions.map(execution => execution.industry).join(', ');

  const markIndustryTask = (industry: string, taskId: SectionId) => {
    updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
      const current = createIndustryExecution(industry, prev[industry]);
      const updated = getExecutionWithStatus({
        ...current,
        tasks: {
          ...current.tasks,
          [taskId]: true,
        },
      });
      return {
        ...prev,
        [industry]: updated,
      };
    });
  };

  const getBackTarget = () => {
    switch (sectionId) {
      case SectionId.Facade:
        return SectionId.CheckIn;
      case SectionId.CheckIn:
        return SectionId.Dashboard;
      case SectionId.Antes:
        return SectionId.Dashboard;
      case SectionId.Estoque:
        return SectionId.Dashboard;
      case SectionId.Depois:
        return SectionId.Antes;
      case SectionId.Trocas:
        return SectionId.Depois;
      case SectionId.CheckOut:
        return SectionId.Dashboard;
      case SectionId.Sync:
        return SectionId.CheckOut;
      default:
        return null;
    }
  };

  const renderBackButton = () => {
    const target = getBackTarget();
    if (!target) return null;

    return (
      <button
        onClick={() => navigateTo(target)}
        className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#E65C5C] hover:border-[#E65C5C]/20 transition-all"
      >
        <ArrowLeft size={14} />
        Voltar
      </button>
    );
  };

  const formatPhotoTimestamp = () => new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());

  const drawStampLine = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = word;
        return;
      }
      line = testLine;
    });

    if (line) lines.push(line);

    lines.slice(0, 3).forEach((lineText, index) => {
      ctx.fillText(lineText, x, y + (index * lineHeight));
    });

    return lines.slice(0, 3).length * lineHeight;
  };

  const processPhotoForReport = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível processar a foto.'));
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxLongEdge = 1280;
        const jpegQuality = 0.62;
        const scale = Math.min(1, maxLongEdge / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível preparar a foto.'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const padding = Math.max(18, Math.round(canvas.width * 0.035));
        const fontSize = Math.max(18, Math.round(canvas.width * 0.036));
        const lineHeight = Math.round(fontSize * 1.22);
        const maxTextWidth = Math.round(canvas.width * 0.82);
        const x = canvas.width - padding;
        let y = padding + fontSize;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `600 ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.18));
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        y += drawStampLine(ctx, formatPhotoTimestamp(), x, y, maxTextWidth, lineHeight);
        drawStampLine(ctx, visitState.currentStore || 'Loja não informada', x, y, maxTextWidth, lineHeight);

        resolve(canvas.toDataURL('image/jpeg', jpegQuality).split(',')[1]);
      };
    };
    reader.readAsDataURL(file);
  });

  const handlePhotoCapture = async (section: string, file: File) => {
    const activeIndustry = selectedIndustry;
    let compressedBase64 = '';

    try {
      compressedBase64 = await processPhotoForReport(file);
    } catch (error: any) {
      alert(error.message || 'Não foi possível processar a foto.');
      return;
    }
        
    if (isIndustryStep(section) && activeIndustry) {
      if (section === SectionId.Estoque) {
        updateVisit('stockQuantities', (prev: any) => ({ ...prev }));
        updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
          const existing = prev[activeIndustry];
          if (!existing) return prev;
          const currentCategoryPhotos = existing.photos?.[section] || [];
          return {
            ...prev,
            [activeIndustry]: {
              ...existing,
              photos: {
                ...existing.photos,
                [section]: [...currentCategoryPhotos, compressedBase64],
              },
            },
          };
        });
        updateVisit('photos', (prevPhotos: any = {}) => {
          const currentCategoryPhotos = prevPhotos[section] || [];
          return {
            ...prevPhotos,
            [section]: [...currentCategoryPhotos, compressedBase64],
          };
        });
        return;
      }

      updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
        const current = createIndustryExecution(activeIndustry, prev[activeIndustry]);
        const currentCategoryPhotos = current.photos?.[section] || [];
        const updated = getExecutionWithStatus({
          ...current,
          tasks: {
            ...current.tasks,
            [section]: true,
          },
          photos: {
            ...current.photos,
            [section]: [...currentCategoryPhotos, compressedBase64],
          },
        });
        return {
          ...prev,
          [activeIndustry]: updated,
        };
      });
      if (section === SectionId.Trocas) {
        updateVisit('returnsPhotosByIndustry', (prev: Record<string, string[]> = {}) => ({
          ...prev,
          [activeIndustry]: [
            ...(prev[activeIndustry] || []),
            compressedBase64,
          ],
        }));
      }
      return;
    }

    updateVisit('photos', (prevPhotos: any = {}) => {
      const currentCategoryPhotos = prevPhotos[section] || [];
      return {
        ...prevPhotos,
        [section]: [...currentCategoryPhotos, compressedBase64],
      };
    });
  };

  const [syncSuccess, setSyncSuccess] = useState(false);

  const formatSyncError = (message: string) => {
    if (/make retornou http 500/i.test(message) || /scenario failed to initialize/i.test(message)) {
      return 'Visita salva para reenvio. A integração Make não inicializou o cenário. Verifique o cenário ativo/conexões da Make e reenvie a fila.';
    }

    return message;
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setSyncError(null);
    setSyncMessage('Testando conexão com o servidor...');
    try {
      const ok = await apiService.pingMake();
      if (ok) {
        setSyncMessage('Servidor conectado e integrações configuradas.');
      } else {
        setSyncError('O servidor respondeu, mas retornou configuração incompleta.');
      }
    } catch (e: any) {
      setSyncError(`Falha na conexão com o servidor: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const syncQueuedVisit = async (payload: any, queueVisitId?: string, useRetryEndpoint = false) => {
    const queued = await upsertQueuedVisit(payload, queueVisitId || payload.visitId, useRetryEndpoint ? 'syncing' : 'pending');
    const resolvedVisitId = queued.visitId;
    let activeVisitId = resolvedVisitId;
    updateVisit('visitId', resolvedVisitId);

    try {
      await updateQueuedVisit(resolvedVisitId, {
        status: 'syncing',
        error: null,
        payload: { ...payload, visitId: resolvedVisitId },
      });

      const draft = await apiService.createVisit({ ...payload, visitId: resolvedVisitId });
      const serverVisitId = draft.visitId || resolvedVisitId;
      activeVisitId = serverVisitId;
      updateVisit('visitId', serverVisitId);

      if (serverVisitId !== resolvedVisitId) {
        await removeQueuedVisit(resolvedVisitId);
        await upsertQueuedVisit(payload, serverVisitId, 'pending');
      }

      const result = useRetryEndpoint
        ? await apiService.retrySync(serverVisitId)
        : await apiService.syncVisit({ ...payload, visitId: serverVisitId }, (msg) => setSyncMessage(msg));

      if (result.syncStatus === 'enviado') {
        await removeQueuedVisit(serverVisitId);
        setQueueCount(await getQueuedVisitCount());
        return result;
      }

      await updateQueuedVisit(serverVisitId, {
        status: 'error',
        error: result.syncError || 'Falha na sincronização',
        attempts: queued.attempts + 1,
        payload: { ...payload, visitId: serverVisitId },
      });
      setQueueCount(await getQueuedVisitCount());
      throw new Error(result.syncError || 'Falha na sincronização');
    } catch (error: any) {
      await updateQueuedVisit(activeVisitId, {
        status: 'error',
        error: error.message || 'Falha na sincronização',
        attempts: queued.attempts + 1,
        payload: { ...payload, visitId: activeVisitId },
      });
      setQueueCount(await getQueuedVisitCount());
      throw error;
    }
  };

  const handleSync = async () => {
    console.log(">>> BOTAO SINCRONIZAR CLICADO <<<");
    setSyncError(null);
    setSyncSuccess(false);
    
    const checkoutPhoto = photos[SectionId.CheckOut]?.[0];
    
    if (!checkoutPhoto) {
      const msg = "ERRO: Foto de Saída não encontrada. Por favor, volte e tire a foto de saída novamente.";
      setSyncError(msg);
      return;
    }

    if (!canCheckOut) {
      const pending = pendingIndustryExecutions.map(execution => execution.industry).join(', ') || 'nenhuma empresa aberta';
      setSyncError(`ERRO: finalize todos os fluxos de empresa antes de sincronizar. Pendentes: ${pending}.`);
      return;
    }

    setIsSyncing(true);
    setSyncMessage('Iniciando sincronização...');
    try {
      await syncQueuedVisit({
        ...visitState,
        timestamp: getBrasiliaISO()
      }, visitState.visitId || undefined);
      setSyncSuccess(true);
      setQueueCount(await getQueuedVisitCount());
      setTimeout(() => {
        onReset();
      }, 3000);
    } catch (error: any) {
      setSyncError(formatSyncError(error.message || "Erro desconhecido na sincronização"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryQueue = async () => {
    const queuedVisits = await listQueuedVisits();
    if (queuedVisits.length === 0) {
      setSyncError('Não há visitas na fila local para reenviar.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(false);

    try {
      for (const queuedVisit of queuedVisits) {
        setSyncMessage(`Reenviando ${queuedVisit.visitId}...`);
        await syncQueuedVisit(queuedVisit.payload, queuedVisit.visitId, true);
      }

      setSyncSuccess(true);
      setQueueCount(await getQueuedVisitCount());
      setTimeout(() => {
        onReset();
      }, 3000);
    } catch (error: any) {
      setSyncError(formatSyncError(error.message || 'Não foi possível reenviar a fila local.'));
    } finally {
      setIsSyncing(false);
    }
  };

  const renderSection = () => {
    switch (sectionId) {
      case SectionId.Supervisor:
        return <SupervisorDashboard />;

      case SectionId.Facade:
        const facadePhotos = photos[SectionId.Facade] || [];
        return (
          <div className="space-y-8 animate-in">
            <div className="flex items-center justify-between gap-4">
              {renderBackButton()}
              <div className="flex-1" />
            </div>
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-[#0F172A]">Capturar Fachada</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tire uma foto da frente da loja para iniciar</p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              <div className="aspect-[4/3] bg-slate-100 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group">
                {facadePhotos[0] ? (
                  <img src={`data:image/jpeg;base64,${facadePhotos[0]}`} className="w-full h-full object-cover" alt="Fachada" />
                ) : (
                  <Camera className="w-16 h-16 text-slate-300" />
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePhotoCapture(SectionId.Facade, file);
                    }
                  }}
                />
              </div>

              <button 
                disabled={!facadePhotos[0]}
                onClick={() => {
                  updateVisit('checkInDone', true);
                  updateVisit('tasks', (prev: any) => ({ ...prev, [SectionId.CheckIn]: true }));
                  navigateTo(SectionId.Dashboard);
                }}
                className={`w-full py-6 rounded-3xl font-black uppercase tracking-widest shadow-xl transition-all ${facadePhotos[0] ? 'bg-[#0F172A] text-white shadow-slate-900/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              >
                Confirmar e Iniciar
              </button>
            </div>
          </div>
        );

      case SectionId.Dashboard:
        return (
          <div className="space-y-8 animate-in">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0F172A]">
                  Progresso da visita
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">
                  {visitState.currentStore || 'Nenhuma loja selecionada'}
                </p>
              </div>
              {visitState.checkInDone && (
                <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                  Check-in realizado
                </div>
              )}
            </div>

            {visitState.checkInDone && activeIndustryExecutions.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresas nesta visita</p>
                    <p className="font-black uppercase text-lg tracking-tight text-[#0F172A]">
                      {activeIndustryExecutions.filter(isExecutionComplete).length}/{activeIndustryExecutions.length} fluxos concluídos
                    </p>
                  </div>
                  {activeIndustryNames && (
                    <div className="bg-slate-50 px-4 py-3 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Empresas iniciadas</p>
                      <p className="font-black uppercase text-sm text-[#0F172A]">{activeIndustryNames}</p>
                    </div>
                  )}
                </div>
                {pendingIndustryExecutions.length > 0 && (
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest bg-orange-50 p-4 rounded-2xl">
                    Check-out bloqueado até concluir: {pendingIndustryExecutions.map(execution => execution.industry).join(', ')}.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {!visitState.checkInDone ? (
                <button 
                  onClick={() => navigateTo(SectionId.CheckIn)}
                  className="bg-[#0F172A] p-10 rounded-[40px] text-white flex flex-col justify-between min-h-[280px] group transition-all hover:scale-[1.02]"
                >
                  <MapPin className="w-12 h-12 text-[#E65C5C] group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-3xl font-black uppercase tracking-tighter leading-none">Selecionar<br/>Loja</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-4">Clique para ver as lojas disponíveis</p>
                  </div>
                </button>
              ) : (
                <>
                  <DashboardCard 
                    icon={<Camera className={selectedAntesComplete ? "text-emerald-500" : "text-[#E65C5C]"} />} 
                    title="1. Antes" 
                    count={selectedExecution?.photos?.[SectionId.Antes]?.length || 0} 
                    status={selectedAntesComplete ? "Concluído" : "Pendente"}
                    isCompleted={selectedAntesComplete}
                    onClick={() => navigateTo(SectionId.Antes)}
                  />
                  <DashboardCard 
                    icon={<Boxes className={stockComplete ? "text-emerald-500" : "text-blue-500"} />} 
                    title="2. Estoque (Opcional)" 
                    count={selectedExecution?.photos?.[SectionId.Estoque]?.length || 0}
                    status={stockComplete ? "Concluído" : "Pendente"} 
                    isCompleted={stockComplete}
                    isDisabled={!visitState.checkInDone}
                    onClick={() => {
                      navigateTo(SectionId.Estoque);
                    }}
                  />
                  <DashboardCard 
                    icon={<Camera className={selectedDepoisComplete ? "text-emerald-500" : "text-purple-500"} />} 
                    title="3. Depois" 
                    count={selectedExecution?.photos?.[SectionId.Depois]?.length || 0} 
                    status={selectedDepoisComplete ? "Concluído" : "Pendente"}
                    isCompleted={selectedDepoisComplete}
                    isDisabled={!selectedIndustry || !selectedAntesComplete}
                    onClick={() => {
                      if (!selectedIndustry) {
                        alert("Selecione ou abra uma empresa na seção 'ANTES' antes de prosseguir.");
                        navigateTo(SectionId.Antes);
                        return;
                      }
                      if (!selectedAntesComplete) return alert("Complete a etapa 'ANTES' desta empresa primeiro.");
                      navigateTo(SectionId.Depois);
                    }}
                  />
                  <DashboardCard 
                    icon={<PackageOpen className={returnsStepComplete ? "text-emerald-500" : "text-orange-500"} />} 
                    title="4. Trocas" 
                    status={returnsStepComplete ? "Concluído" : "Pendente"} 
                    isCompleted={returnsStepComplete}
                    isDisabled={!selectedIndustry || !selectedDepoisComplete}
                    onClick={() => {
                      if (!selectedIndustry) {
                        alert("Selecione uma empresa em andamento primeiro.");
                        navigateTo(SectionId.Antes);
                        return;
                      }
                      if (!selectedDepoisComplete) return alert("Complete a etapa 'DEPOIS' desta empresa primeiro.");
                      navigateTo(SectionId.Trocas);
                    }}
                  />
                  <DashboardCard 
                    icon={<Send className={tasks[SectionId.CheckOut] ? "text-emerald-500" : "text-slate-500"} />} 
                    title="5. Check-out" 
                    status={tasks[SectionId.CheckOut] ? "Concluído" : "Pendente"}
                    isCompleted={tasks[SectionId.CheckOut]}
                    isDisabled={!canCheckOut}
                    onClick={() => {
                      if (!canCheckOut) {
                        if (activeIndustryExecutions.length === 0) {
                          alert("Abra pelo menos uma empresa na etapa 'ANTES' antes do check-out.");
                          navigateTo(SectionId.Antes);
                          return;
                        }
                        alert(`Finalize os fluxos em aberto antes do check-out: ${pendingIndustryExecutions.map(execution => execution.industry).join(', ')}.`);
                        return;
                      }
                      navigateTo(SectionId.CheckOut);
                    }}
                  />
                  {tasks[SectionId.CheckOut] && (
                    <DashboardCard 
                      icon={<CloudUpload className="text-blue-600" />} 
                      title="6. Finalizar" 
                      status="Sincronizar"
                      onClick={() => navigateTo(SectionId.Sync)}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        );

      case SectionId.CheckIn:
        return (
          <div className="max-w-2xl mx-auto space-y-8 py-6 animate-in">
            <div className="flex items-center justify-between gap-4">
              {renderBackButton()}
              <div className="flex-1" />
            </div>
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-white rounded-[24px] shadow-xl shadow-slate-200/40 flex items-center justify-center mx-auto border border-slate-50 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 rounded-[24px]" />
                <CriativaIcon className="w-10 h-10 relative z-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0F172A] leading-none">Minha Rota</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Selecione o PDV para atendimento</p>
              </div>
            </div>

            <div className="space-y-3">
              {visitState.availableStores.map(store => (
                <button 
                  key={store.id} 
                  onClick={() => handleCheckIn(store)}
                  className="w-full bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-[#E65C5C] hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-[#E65C5C]/5 transition-colors">
                      <div className="w-8 h-8 border-2 border-slate-200 rounded-lg flex items-center justify-center group-hover:border-[#E65C5C]/30">
                        <MapPin className="text-slate-300 group-hover:text-[#E65C5C] w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-black uppercase text-lg tracking-tight text-[#0F172A] group-hover:text-[#E65C5C] transition-colors">{store.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{store.region}</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#E65C5C] transition-all">
                    <ChevronRight className="text-slate-300 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case SectionId.Antes:
      case SectionId.Depois:
        const isAntes = sectionId === SectionId.Antes;
        const industries: string[] = visitState.industries && visitState.industries.length > 0 
          ? visitState.industries 
          : ['Veneza', 'Idealpan', 'Maricota', 'VidaVeg'];
        const currentPhotos = getIndustryPhotos(sectionId);
        const canAttachPhotos = isAntes
          ? Boolean(visitState.selectedIndustry)
          : Boolean(visitState.selectedIndustry && afterIndustryExecutions.some(execution => execution.industry === visitState.selectedIndustry));

        return (
          <div className="space-y-8 animate-in">
            <div className="flex items-center justify-between gap-4">
              {renderBackButton()}
              <div className="flex-1" />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Fotos de {isAntes ? 'Antes' : 'Depois'}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentPhotos.length}/{MAX_PHOTOS_PER_SECTION} Fotos</p>
            </div>

            {isAntes && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {visitState.selectedIndustry ? `Indústria Selecionada: ${visitState.selectedIndustry}` : 'Selecione a Indústria'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {industries.map(ind => {
                    const execution = industryExecutions[ind];
                    const complete = isExecutionComplete(execution);
                    const opened = Boolean(execution);
                    return (
                    <button 
                      key={ind}
                      onClick={() => openIndustryExecution(ind)}
                      className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${visitState.selectedIndustry === ind ? 'bg-[#0F172A] text-white border-[#0F172A]' : complete ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : opened ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'}`}
                    >
                      {ind}
                      {complete ? ' ✓' : opened ? ' •' : ''}
                    </button>
                  )})}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Voce pode abrir outra industria antes do check-out. Cada uma precisa concluir Antes, Depois e Trocas.
                </p>
              </div>
            )}

            {!isAntes && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresas abertas em Antes</p>
                {afterIndustryExecutions.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {afterIndustryExecutions.map(execution => {
                      const isSelected = visitState.selectedIndustry === execution.industry;
                      const complete = isExecutionComplete(execution);
                      return (
                        <button
                          key={execution.industry}
                          onClick={() => openIndustryExecution(execution.industry)}
                          className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${isSelected ? 'bg-[#0F172A] text-white border-[#0F172A]' : complete ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'}`}
                        >
                          {execution.industry}
                          {complete ? ' ✓' : ' •'}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-[#E65C5C] uppercase bg-red-50 p-4 rounded-xl">
                    Abra uma empresa em "ANTES" antes de registrar fotos do Depois.
                  </p>
                )}
              </div>
            )}

            {canAttachPhotos && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anexar fotos</p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {isAntes ? 'Registre a situação inicial' : 'Registre a situação final'} de {visitState.selectedIndustry}.
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <button 
                      disabled={currentPhotos.length >= MAX_PHOTOS_PER_SECTION}
                      className={`bg-[#E65C5C] text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-[#E65C5C]/20 ${currentPhotos.length >= MAX_PHOTOS_PER_SECTION ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Plus size={16} /> Adicionar Foto
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && currentPhotos.length < MAX_PHOTOS_PER_SECTION) {
                          handlePhotoCapture(sectionId, file);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {currentPhotos.map((photo, idx) => (
                <div key={idx} className="aspect-square bg-slate-200 rounded-2xl overflow-hidden relative group">
                  <img src={`data:image/jpeg;base64,${photo}`} className="w-full h-full object-cover" alt="Captura" />
                  <button 
                    onClick={() => {
                      const newPhotos = currentPhotos.filter((_, i) => i !== idx);
                      updateSelectedExecution(execution => ({
                        ...execution,
                        tasks: {
                          ...execution.tasks,
                          [sectionId]: newPhotos.length > 0 ? true : false,
                        },
                        photos: {
                          ...execution.photos,
                          [sectionId]: newPhotos,
                        },
                      }));
                    }}
                    className="absolute top-2 right-2 bg-white/20 backdrop-blur-md p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4 pt-4">
              <button 
                disabled={isAnalyzing}
                onClick={async () => {
                  if (!visitState.selectedIndustry) {
                    alert("Selecione uma indústria primeiro.");
                    if (isAntes) navigateTo(SectionId.Antes);
                    return;
                  }
                  if (!isAntes && !afterIndustryExecutions.some((execution) => execution.industry === visitState.selectedIndustry)) {
                    alert("Selecione uma empresa que já abriu fluxo em Antes.");
                    return;
                  }
                  if (currentPhotos.length === 0) return alert("Tire pelo menos uma foto.");

                  const resolvedVisitId = visitState.visitId || generateVisitId();
                  if (!visitState.visitId) {
                    updateVisit('visitId', resolvedVisitId);
                  }

                  setIsAnalyzing(true);
                  
                  // Mark task as done and navigate IMMEDIATELY for instant feel
                  markIndustryTask(visitState.selectedIndustry, sectionId);
                  updateVisit('tasks', (prev: any) => ({ ...prev, [sectionId]: true }));
                  navigateTo(SectionId.Dashboard);

                  // Run AI analysis in background without blocking the user
                  if (currentPhotos[0]) {
                    analyzeProductPhoto({
                      base64Image: currentPhotos[0],
                      industries: [visitState.selectedIndustry || 'Veneza'],
                      visitId: resolvedVisitId,
                      sectionId,
                    })
                      .then(result => {
                        setAiResult(result);
                        const updatedAiResults = { ...visitState.aiResults, [sectionId]: result };
                        updateVisit('aiResults', updatedAiResults);
                        updateSelectedExecution(execution => ({
                          ...execution,
                          aiResults: {
                            ...execution.aiResults,
                            [sectionId]: result,
                          },
                        }));
                      })
                      .catch(err => console.error("AI Background Error:", err))
                      .finally(() => {
                        setIsAnalyzing(false);
                      });
                  } else {
                    setIsAnalyzing(false);
                  }
                }}
                className="w-full bg-[#0F172A] text-white py-6 rounded-3xl font-black uppercase text-[12px] tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                Validar e Salvar Registro
              </button>
            </div>

            {aiResult && (
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4 animate-in">
                <div className="flex items-center gap-2 text-blue-600">
                  <Sparkles size={18} />
                  <h4 className="font-black uppercase text-xs tracking-widest">Resultado da Validação</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Organização</p>
                    <p className="font-black uppercase text-sm">{aiResult.organization}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Conformidade</p>
                    <p className="font-black uppercase text-sm">{aiResult.complianceStatus}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">{aiResult.observations}</p>
              </div>
            )}
          </div>
        );

      case SectionId.Estoque:
        const estoquePhotos = stockIndustry
          ? (industryExecutions[stockIndustry]?.photos?.[SectionId.Estoque] || photos[SectionId.Estoque] || [])
          : [];
        const industriesEstoque: string[] = visitState.industries && visitState.industries.length > 0 
          ? visitState.industries 
          : ['Veneza', 'Idealpan', 'Maricota', 'VidaVeg'];

        return (
          <div className="space-y-8 animate-in">
            <div className="flex items-center justify-between gap-4">
              {renderBackButton()}
              <div className="flex-1" />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Check de Estoque</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{estoquePhotos.length}/{MAX_PHOTOS_PER_SECTION} Fotos</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {stockIndustry ? `Empresa ativa no estoque: ${stockIndustry}` : 'Selecione a empresa para informar o estoque'}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {industriesEstoque.map(ind => {
                  const isActive = stockIndustry === ind;
                  return (
                    <button
                      key={ind}
                      onClick={() => setStockIndustry(ind)}
                      className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${isActive ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'}`}
                    >
                      {ind}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantidade de estoque</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    {stockIndustry ? `Registro para ${stockIndustry}` : 'Escolha uma empresa acima para liberar o campo'}
                  </p>
                </div>
                {stockIndustry && (
                  <div className="bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Empresa selecionada
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="font-black uppercase text-xs tracking-tight text-slate-600">{stockIndustry || 'Empresa'}</span>
                <input
                  type="number"
                  placeholder="Qtd"
                  value={currentStockQuantity}
                  onChange={(e) => {
                    if (!stockIndustry) return;
                    const val = e.target.value;
                    updateVisit('stockQuantities', (prev: any) => ({ ...prev, [stockIndustry]: val }));
                    updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
                      const existing = prev[stockIndustry];
                      if (!existing) return prev;
                      return {
                        ...prev,
                        [stockIndustry]: {
                          ...existing,
                          stockQuantities: {
                            ...existing.stockQuantities,
                            [stockIndustry]: val,
                          },
                        },
                      };
                    });
                  }}
                  disabled={!stockIndustry}
                  className="w-28 p-3 bg-slate-50 rounded-xl font-bold text-center border border-slate-100 focus:border-blue-500 outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {stockIndustry && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anexar fotos</p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      Foto opcional do estoque de {stockIndustry}.
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <button 
                      disabled={estoquePhotos.length >= MAX_PHOTOS_PER_SECTION}
                      className={`bg-[#E65C5C] text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-[#E65C5C]/20 ${estoquePhotos.length >= MAX_PHOTOS_PER_SECTION ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Plus size={16} /> Adicionar Foto
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && estoquePhotos.length < MAX_PHOTOS_PER_SECTION) {
                          const previousStockIndustry = stockIndustry;
                          processPhotoForReport(file)
                            .then((compressedBase64) => {
                              updateVisit('photos', (prev: any = {}) => {
                                const currentCategoryPhotos = prev[SectionId.Estoque] || [];
                                return { ...prev, [SectionId.Estoque]: [...currentCategoryPhotos, compressedBase64] };
                              });
                              updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
                                const existing = prev[previousStockIndustry];
                                if (!existing) return prev;
                                const currentCategoryPhotos = existing.photos?.[SectionId.Estoque] || [];
                                return {
                                  ...prev,
                                  [previousStockIndustry]: {
                                    ...existing,
                                    photos: {
                                      ...existing.photos,
                                      [SectionId.Estoque]: [...currentCategoryPhotos, compressedBase64],
                                    },
                                  },
                                };
                              });
                            })
                            .catch((error) => {
                              alert(error.message || 'Não foi possível processar a foto.');
                            });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {estoquePhotos.map((photo, idx) => (
                <div key={idx} className="aspect-square bg-slate-200 rounded-2xl overflow-hidden relative group">
                  <img src={`data:image/jpeg;base64,${photo}`} className="w-full h-full object-cover" alt="Estoque" />
                  <button 
                    onClick={() => {
                      const newPhotos = estoquePhotos.filter((_, i) => i !== idx);
                      updateVisit('photos', (prev: any = {}) => ({ ...prev, [SectionId.Estoque]: newPhotos }));
                      updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
                        const existing = stockIndustry ? prev[stockIndustry] : null;
                        if (!stockIndustry || !existing) return prev;
                        return {
                          ...prev,
                          [stockIndustry]: {
                            ...existing,
                            photos: {
                              ...existing.photos,
                              [SectionId.Estoque]: newPhotos,
                            },
                          },
                        };
                      });
                    }}
                    className="absolute top-2 right-2 bg-white/20 backdrop-blur-md p-1 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={() => {
                if (!stockIndustry) {
                  alert("Selecione uma empresa para salvar o estoque.");
                  return;
                }

                if (!isCurrentStockQuantityValid) {
                  alert(`Informe uma quantidade válida para ${stockIndustry} antes de salvar o estoque.`);
                  return;
                }

                updateVisit('tasks', (prev: any) => ({ ...prev, [SectionId.Estoque]: true }));
                updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
                  const existing = prev[stockIndustry];
                  if (!existing) return prev;
                  return {
                    ...prev,
                    [stockIndustry]: {
                      ...existing,
                      stockQuantities: {
                        ...existing.stockQuantities,
                        [stockIndustry]: currentStockQuantity,
                      },
                    },
                  };
                });
                navigateTo(SectionId.Dashboard);
              }}
              disabled={!stockIndustry}
              className="w-full bg-[#0F172A] text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salvar Registros de Estoque
            </button>
          </div>
        );

      case SectionId.Trocas:
        const returnsPhotos = getIndustryPhotos(SectionId.Trocas);
        const selectedHasReturns = selectedExecution?.hasReturns ?? (activeIndustryExecutions.length === 0 ? visitState.hasReturns : null);
        const allReturnsReady = afterIndustryExecutions.length > 0 && afterIndustryExecutions.every(hasReturnsEvidence);
        const pendingReturnIndustries = afterIndustryExecutions.filter(execution => !hasReturnsEvidence(execution));
        return (
          <div className="space-y-8 animate-in">
            <div className="flex items-center justify-between gap-4">
              {renderBackButton()}
              <div className="flex-1" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Trocas e Avarias</h2>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresas abertas em Antes</p>
              {afterIndustryExecutions.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {afterIndustryExecutions.map(execution => {
                    const isSelected = visitState.selectedIndustry === execution.industry;
                    const answered = execution.hasReturns !== null;
                    return (
                      <button
                        key={execution.industry}
                        onClick={() => openIndustryExecution(execution.industry)}
                        className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${isSelected ? 'bg-[#0F172A] text-white border-[#0F172A]' : answered ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'}`}
                      >
                        {execution.industry}
                        {answered ? ' ✓' : ' •'}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] font-bold text-[#E65C5C] uppercase bg-red-50 p-4 rounded-xl">
                  Abra uma empresa em "ANTES" antes de informar trocas.
                </p>
              )}
            </div>
            {afterIndustryExecutions.length > 0 && !allReturnsReady && (
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 p-4 rounded-2xl">
                Responda todas as empresas antes de salvar e continuar. Se marcar sim, anexe a foto. Pendentes: {pendingReturnIndustries.map(execution => execution.industry).join(', ')}.
              </p>
            )}
            
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm text-center space-y-8">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
                <PackageOpen className="text-orange-500 w-10 h-10" />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-black uppercase tracking-tight">Houve trocas ou avarias{visitState.selectedIndustry ? ` (${visitState.selectedIndustry})` : ''}?</h3>
                <div className="flex gap-4 max-w-xs mx-auto">
                  <button 
                    onClick={() => {
                      if (!visitState.selectedIndustry) {
                        alert("Selecione uma empresa da lista acima para informar trocas.");
                        return;
                      }
                      updateSelectedExecution(execution => ({ ...execution, hasReturns: true }));
                      updateVisit('hasReturns', true);
                    }}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${selectedHasReturns === true ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    Sim
                  </button>
                  <button 
                    onClick={() => {
                      if (!visitState.selectedIndustry) {
                        alert("Selecione uma empresa da lista acima para informar trocas.");
                        return;
                      }
                      updateSelectedExecution(execution => ({
                        ...execution,
                        hasReturns: false,
                        photos: {
                          ...execution.photos,
                          [SectionId.Trocas]: [],
                        },
                      }));
                      updateVisit('hasReturns', false);
                      updateVisit('photos', (prev: any) => ({ ...prev, [SectionId.Trocas]: [] }));
                      updateVisit('returnsPhotosByIndustry', (prev: Record<string, string[]> = {}) => ({
                        ...prev,
                        [visitState.selectedIndustry as string]: [],
                      }));
                    }}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${selectedHasReturns === false ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    Não
                  </button>
                </div>
              </div>

              {selectedHasReturns && (
                <div className="space-y-6 pt-6 border-t border-slate-50">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fotos das Trocas ({returnsPhotos.length}/{MAX_PHOTOS_PER_SECTION})</p>
                    <div className="relative">
                      <button 
                        disabled={returnsPhotos.length >= MAX_PHOTOS_PER_SECTION}
                        className={`bg-orange-500 text-white px-5 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 ${returnsPhotos.length >= MAX_PHOTOS_PER_SECTION ? 'opacity-50' : ''}`}
                      >
                        <Camera size={14} /> Capturar
                      </button>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && returnsPhotos.length < MAX_PHOTOS_PER_SECTION) {
                            handlePhotoCapture(SectionId.Trocas, file);
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {returnsPhotos.map((photo, idx) => (
                      <div key={idx} className="aspect-square bg-slate-100 rounded-xl overflow-hidden relative">
                        <img src={`data:image/jpeg;base64,${photo}`} className="w-full h-full object-cover" alt="Troca" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                disabled={!allReturnsReady}
                onClick={() => {
                  if (!allReturnsReady) {
                    alert(`Responda todas as empresas antes de salvar e continuar. Se marcar sim, anexe a foto. Pendentes: ${pendingReturnIndustries.map(execution => execution.industry).join(', ')}`);
                    return;
                  }
                  updateVisit('tasks', (prev: any) => ({ ...prev, [SectionId.Trocas]: true }));
                  updateVisit('industryExecutions', (prev: Record<string, IndustryExecution> = {}) => {
                    const next = { ...prev };
                    afterIndustryExecutions.forEach((execution) => {
                      const current = createIndustryExecution(execution.industry, next[execution.industry]);
                      next[execution.industry] = getExecutionWithStatus({
                        ...current,
                        tasks: {
                          ...current.tasks,
                          [SectionId.Trocas]: true,
                        },
                      });
                    });
                    return next;
                  });
                  navigateTo(SectionId.Dashboard);
                }}
                className={`w-full py-6 rounded-3xl font-black uppercase tracking-widest transition-all ${allReturnsReady ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-300'}`}
              >
                Salvar e Continuar
              </button>
            </div>
          </div>
        );
      case SectionId.CheckOut:
        const checkoutPhoto = (photos[SectionId.CheckOut] || [])[0];
        if (!canCheckOut) {
          return (
            <div className="space-y-8 animate-in">
              <div className="flex items-center justify-between gap-4">
                {renderBackButton()}
                <div className="flex-1" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Finalizar Visita</h2>
              <div className="bg-orange-50 p-8 rounded-[32px] border border-orange-100 text-orange-700 space-y-4">
                <p className="font-black uppercase tracking-widest text-xs">Check-out bloqueado</p>
                <p className="text-sm font-bold leading-relaxed">
                  Conclua todos os fluxos de empresas abertos antes de registrar a saída.
                </p>
                {pendingIndustryExecutions.length > 0 && (
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    Pendentes: {pendingIndustryExecutions.map(execution => execution.industry).join(', ')}
                  </p>
                )}
                <button
                  onClick={() => navigateTo(SectionId.Dashboard)}
                  className="bg-[#0F172A] text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                >
                  Voltar ao progresso
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-8 animate-in">
            <div className="flex items-center justify-between gap-4">
              {renderBackButton()}
              <div className="flex-1" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Finalizar Visita</h2>
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryItem label="Fotos Total" value={(Object.values(photos).flat().length + totalIndustryPhotos).toString()} />
                <SummaryItem label="Empresas" value={`${activeIndustryExecutions.length}`} />
                <SummaryItem label="Loja" value={visitState.currentStore} />
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Foto de Saída</p>
                <div className="max-w-xs mx-auto aspect-[4/3] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group">
                  {checkoutPhoto ? (
                    <img src={`data:image/jpeg;base64,${checkoutPhoto}`} className="w-full h-full object-cover" alt="Saída" />
                  ) : (
                    <Camera className="w-12 h-12 text-slate-300" />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoCapture(SectionId.CheckOut, file);
                    }}
                  />
                </div>
              </div>

              <button 
                disabled={!checkoutPhoto}
                onClick={() => {
                  updateVisit('checkOutTime', getBrasiliaISO());
                  updateVisit('tasks', (prev: any) => ({ ...prev, [SectionId.CheckOut]: true }));
                  navigateTo(SectionId.Sync);
                }}
                className={`w-full py-6 rounded-3xl font-black uppercase tracking-widest shadow-xl transition-all ${checkoutPhoto ? 'bg-[#0F172A] text-white shadow-slate-900/20' : 'bg-slate-100 text-slate-300'}`}
              >
                Registro da Saída
              </button>
            </div>
          </div>
        );

      case SectionId.Sync:
        return (
          <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-8 animate-in py-10">
            <div className="w-full flex items-center justify-start">
              {renderBackButton()}
            </div>
            <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center transition-all ${syncSuccess ? 'bg-emerald-500' : isSyncing ? 'bg-blue-50' : 'bg-emerald-50'}`}>
              {syncSuccess ? <CheckCircle2 className="text-white w-10 h-10" /> : isSyncing ? <Loader2 className="animate-spin text-blue-600 w-10 h-10" /> : <CloudUpload className="text-emerald-600 w-10 h-10" />}
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black uppercase tracking-tighter">
                {syncSuccess ? 'Sucesso!' : isSyncing ? 'Sincronizando...' : 'Pronto para Enviar'}
              </h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
                {syncSuccess ? 'Dados enviados com sucesso para o servidor' : syncMessage}
              </p>
            </div>

            <div className="w-full max-w-md h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${syncSuccess ? 'w-full bg-emerald-500' : isSyncing ? 'w-2/3 bg-blue-500 animate-pulse' : 'w-1/4 bg-emerald-500'}`}
              />
            </div>

            {isSyncing && (
              <button 
                onClick={() => setIsSyncing(false)}
                className="text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors mt-4"
              >
                Cancelar Envio
              </button>
            )}
            {!isSyncing && (
              <div className="flex flex-col items-center gap-4">
                {syncError && (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 max-w-md animate-in">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-tight">{syncError}</p>
                  </div>
                )}
                
                <button
                  onClick={handleSync}
                  className="bg-[#E65C5C] text-white px-12 py-6 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-[#E65C5C]/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Sincronizar Agora
                </button>

                {queueCount > 0 && (
                  <button
                    onClick={handleRetryQueue}
                    className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all"
                  >
                    Reenviar Fila Local ({queueCount})
                  </button>
                )}

                <button
                  disabled={isTesting}
                  onClick={handleTestConnection}
                  className="text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-blue-500 transition-colors flex items-center gap-2"
                >
                  {isTesting ? <Loader2 className="animate-spin w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                  Testar Conexão com Servidor
                </button>

                {syncError && syncError.includes("Saída") && (
                  <button 
                    onClick={() => navigateTo(SectionId.CheckOut)}
                    className="text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-[#0F172A] transition-colors"
                  >
                    Voltar para Foto de Saída
                  </button>
                )}

                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Fila local: {queueCount}
                </p>
              </div>
            )}
          </div>
        );

      default:
        return <div>Seção não encontrada</div>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={sectionId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderSection()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const DashboardCard = ({ icon, title, count, status, onClick, isCompleted, isDisabled }: any) => (
  <button 
    onClick={onClick}
    disabled={isDisabled}
    className={`bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[240px] group transition-all hover:shadow-md relative overflow-hidden ${isCompleted ? 'border-emerald-100' : ''} ${isDisabled ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
  >
    {isCompleted && (
      <div className="absolute top-0 right-0 bg-emerald-500 text-white p-2 rounded-bl-2xl">
        <CheckCircle2 size={16} />
      </div>
    )}
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${isCompleted ? 'bg-emerald-50' : 'bg-slate-50'}`}>
      {icon}
    </div>
    <div className="text-left">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <h4 className={`text-2xl font-black uppercase tracking-tight ${isCompleted ? 'text-emerald-600' : 'text-[#0F172A]'}`}>
        {count !== undefined && count > 0 ? `${count} Fotos` : status}
      </h4>
    </div>
  </button>
);

const SummaryItem = ({ label, value }: any) => (
  <div className="bg-slate-50 p-6 rounded-3xl">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="font-black uppercase text-sm truncate">{value}</p>
  </div>
);

export default ContentArea;
