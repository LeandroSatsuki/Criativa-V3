/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SectionId, VisitState, Industry } from '../types';
import { apiService, getBrasiliaISO } from '../services/apiService';
import { logService } from '../services/logService';
import { analyzeProductPhoto } from '../services/geminiService';
import { getQueuedVisitCount, listQueuedVisits, removeQueuedVisit, upsertQueuedVisit, updateQueuedVisit } from '../services/syncQueue';
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
  const [logs, setLogs] = React.useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [queueCount, setQueueCount] = useState(() => getQueuedVisitCount());

  React.useEffect(() => {
    return logService.subscribe((newLogs) => {
      setLogs([...newLogs]);
    });
  }, []);

  React.useEffect(() => {
    const refreshQueue = () => setQueueCount(getQueuedVisitCount());
    refreshQueue();
    window.addEventListener('storage', refreshQueue);
    return () => window.removeEventListener('storage', refreshQueue);
  }, []);

  const logEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleCheckIn = (store: any) => {
    updateVisit('currentStore', store.name);
    updateVisit('currentStoreId', store.id);
    updateVisit('checkInTime', getBrasiliaISO());
    navigateTo(SectionId.Facade);
  };

  const photos = visitState.photos || {};
  const tasks = visitState.tasks || {};
  const stockQuantities = visitState.stockQuantities || {};
  const selectedIndustry = visitState.selectedIndustry || '';
  const selectedStockQuantity = selectedIndustry ? String(stockQuantities[selectedIndustry] ?? '').trim() : '';
  const isSelectedStockQuantityValid = /^\d+$/.test(selectedStockQuantity);

  const handlePhotoCapture = async (section: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; // Reduced for faster transmission
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1]; // 0.5 quality for smaller payload
        
        // Use functional update to avoid stale state
        updateVisit('photos', (prevPhotos: any = {}) => {
          const currentCategoryPhotos = prevPhotos[section] || [];
          return {
            ...prevPhotos,
            [section]: [...currentCategoryPhotos, compressedBase64]
          };
        });
      };
    };
    reader.readAsDataURL(file);
  };

  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    logService.clear();
    logService.addLog("Iniciando teste de conexão simples...", "info");
    try {
      const ok = await apiService.pingMake();
      if (ok) {
        logService.addLog("✅ Conexão com o backend estabelecida com sucesso!", "success");
      } else {
        logService.addLog("❌ O backend respondeu, mas retornou um erro.", "error");
      }
    } catch (e: any) {
      logService.addLog(`❌ Falha total na conexão: ${e.message}`, "error");
    } finally {
      setIsTesting(false);
    }
  };

  const syncQueuedVisit = async (payload: any, queueVisitId?: string, useRetryEndpoint = false) => {
    const queued = upsertQueuedVisit(payload, queueVisitId || payload.visitId, useRetryEndpoint ? 'syncing' : 'pending');
    const resolvedVisitId = queued.visitId;
    let activeVisitId = resolvedVisitId;
    updateVisit('visitId', resolvedVisitId);

    try {
      updateQueuedVisit(resolvedVisitId, {
        status: 'syncing',
        error: null,
        payload: { ...payload, visitId: resolvedVisitId },
      });

      const draft = await apiService.createVisit({ ...payload, visitId: resolvedVisitId });
      const serverVisitId = draft.visitId || resolvedVisitId;
      activeVisitId = serverVisitId;
      updateVisit('visitId', serverVisitId);

      if (serverVisitId !== resolvedVisitId) {
        removeQueuedVisit(resolvedVisitId);
        upsertQueuedVisit(payload, serverVisitId, 'pending');
      }

      const result = useRetryEndpoint
        ? await apiService.retrySync(serverVisitId)
        : await apiService.syncVisit({ ...payload, visitId: serverVisitId }, (msg) => setSyncMessage(msg));

      if (result.syncStatus === 'enviado') {
        removeQueuedVisit(serverVisitId);
        setQueueCount(getQueuedVisitCount());
        return result;
      }

      updateQueuedVisit(serverVisitId, {
        status: 'error',
        error: result.syncError || 'Falha na sincronização',
        attempts: queued.attempts + 1,
        payload: { ...payload, visitId: serverVisitId },
      });
      setQueueCount(getQueuedVisitCount());
      throw new Error(result.syncError || 'Falha na sincronização');
    } catch (error: any) {
      updateQueuedVisit(activeVisitId, {
        status: 'error',
        error: error.message || 'Falha na sincronização',
        attempts: queued.attempts + 1,
        payload: { ...payload, visitId: activeVisitId },
      });
      setQueueCount(getQueuedVisitCount());
      throw error;
    }
  };

  const handleSync = async () => {
    console.log(">>> BOTAO SINCRONIZAR CLICADO <<<");
    setSyncError(null);
    setSyncSuccess(false);
    logService.clear();
    logService.addLog("Iniciando processo de sincronização...", "info");
    
    const checkoutPhoto = photos[SectionId.CheckOut]?.[0];
    
    if (!checkoutPhoto) {
      const msg = "ERRO: Foto de Saída não encontrada. Por favor, volte e tire a foto de saída novamente.";
      setSyncError(msg);
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
      setQueueCount(getQueuedVisitCount());
      setTimeout(() => {
        onReset();
      }, 3000);
    } catch (error: any) {
      setSyncError(error.message || "Erro desconhecido na sincronização");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryQueue = async () => {
    const queuedVisits = listQueuedVisits();
    if (queuedVisits.length === 0) {
      setSyncError('Não há visitas na fila local para reenviar.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(false);
    logService.clear();
    logService.addLog(`Reenviando fila local (${queuedVisits.length})...`, 'info');

    try {
      for (const queuedVisit of queuedVisits) {
        setSyncMessage(`Reenviando ${queuedVisit.visitId}...`);
        await syncQueuedVisit(queuedVisit.payload, queuedVisit.visitId, true);
      }

      setSyncSuccess(true);
      setQueueCount(getQueuedVisitCount());
      setTimeout(() => {
        onReset();
      }, 3000);
    } catch (error: any) {
      setSyncError(error.message || 'Não foi possível reenviar a fila local.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const renderSection = () => {
    switch (sectionId) {
      case SectionId.Supervisor:
        return <SupervisorDashboard />;

      case SectionId.Facade:
        const facadePhotos = photos[SectionId.Facade] || [];
        return (
          <div className="space-y-8 animate-in">
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
                  Check-in: {visitState.checkInTime ? new Date(visitState.checkInTime).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </div>
              )}
            </div>

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
                    icon={<Camera className={tasks[SectionId.Antes] ? "text-emerald-500" : "text-[#E65C5C]"} />} 
                    title="1. Antes" 
                    count={photos[SectionId.Antes]?.length || 0} 
                    status={tasks[SectionId.Antes] ? "Concluído" : "Pendente"}
                    isCompleted={tasks[SectionId.Antes]}
                    onClick={() => navigateTo(SectionId.Antes)}
                  />
                  <DashboardCard 
                    icon={<Boxes className={tasks[SectionId.Estoque] ? "text-emerald-500" : "text-blue-500"} />} 
                    title="2. Estoque (Opcional)" 
                    count={photos[SectionId.Estoque]?.length || 0}
                    status={tasks[SectionId.Estoque] ? "Concluído" : "Pendente"} 
                    isCompleted={tasks[SectionId.Estoque]}
                    isDisabled={!tasks[SectionId.Antes]}
                    onClick={() => {
                      if (!tasks[SectionId.Antes]) return alert("Complete a etapa 'ANTES' primeiro.");
                      if (!visitState.selectedIndustry) {
                        alert("Por favor, selecione a Indústria na seção 'ANTES' antes de prosseguir.");
                        navigateTo(SectionId.Antes);
                      } else {
                        navigateTo(SectionId.Estoque);
                      }
                    }}
                  />
                  <DashboardCard 
                    icon={<Camera className={tasks[SectionId.Depois] ? "text-emerald-500" : "text-purple-500"} />} 
                    title="3. Depois" 
                    count={photos[SectionId.Depois]?.length || 0} 
                    status={tasks[SectionId.Depois] ? "Concluído" : "Pendente"}
                    isCompleted={tasks[SectionId.Depois]}
                    isDisabled={!tasks[SectionId.Antes]}
                    onClick={() => {
                      if (!tasks[SectionId.Antes]) return alert("Complete a etapa 'ANTES' primeiro.");
                      navigateTo(SectionId.Depois);
                    }}
                  />
                  <DashboardCard 
                    icon={<PackageOpen className={tasks[SectionId.Trocas] ? "text-emerald-500" : "text-orange-500"} />} 
                    title="4. Trocas" 
                    status={tasks[SectionId.Trocas] ? "Concluído" : "Pendente"} 
                    isCompleted={tasks[SectionId.Trocas]}
                    isDisabled={!tasks[SectionId.Depois]}
                    onClick={() => {
                      if (!tasks[SectionId.Depois]) return alert("Complete a etapa 'DEPOIS' primeiro.");
                      navigateTo(SectionId.Trocas);
                    }}
                  />
                  <DashboardCard 
                    icon={<Send className={tasks[SectionId.CheckOut] ? "text-emerald-500" : "text-slate-500"} />} 
                    title="5. Check-out" 
                    status={tasks[SectionId.CheckOut] ? "Concluído" : "Pendente"}
                    isCompleted={tasks[SectionId.CheckOut]}
                    isDisabled={!tasks[SectionId.Trocas]}
                    onClick={() => {
                      if (!tasks[SectionId.Trocas]) return alert("Complete a etapa 'TROCAS' primeiro.");
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
        const currentPhotos = photos[sectionId] || [];

        return (
          <div className="space-y-8 animate-in">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Fotos de {isAntes ? 'Antes' : 'Depois'}</h2>
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentPhotos.length}/30 Fotos</p>
                <div className="relative">
                  <button 
                    disabled={currentPhotos.length >= 30}
                    className={`bg-[#E65C5C] text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-[#E65C5C]/20 ${currentPhotos.length >= 30 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Plus size={16} /> Tirar Foto
                  </button>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && currentPhotos.length < 30) {
                        handlePhotoCapture(sectionId, file);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {isAntes && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {visitState.selectedIndustry ? `Indústria Selecionada: ${visitState.selectedIndustry}` : 'Selecione a Indústria'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {industries
                    .filter(ind => !visitState.selectedIndustry || ind === visitState.selectedIndustry)
                    .map(ind => (
                    <button 
                      key={ind}
                      onClick={() => updateVisit('selectedIndustry', ind)}
                      className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${visitState.selectedIndustry === ind ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'}`}
                    >
                      {ind}
                    </button>
                  ))}
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
                      updateVisit('photos', (prev: any) => ({ ...prev, [sectionId]: newPhotos }));
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
                  if (currentPhotos.length === 0) return alert("Tire pelo menos uma foto.");
                  if (!visitState.selectedIndustry) {
                    alert("Selecione uma indústria primeiro.");
                    if (isAntes) navigateTo(SectionId.Antes);
                    return;
                  }

                  setIsAnalyzing(true);
                  
                  // Mark task as done and navigate IMMEDIATELY for instant feel
                  updateVisit('tasks', { ...tasks, [sectionId]: true });
                  navigateTo(SectionId.Dashboard);

                  // Run AI analysis in background without blocking the user
                  if (currentPhotos[0]) {
                    analyzeProductPhoto(currentPhotos[0], [visitState.selectedIndustry || 'Veneza'])
                      .then(result => {
                        setAiResult(result);
                        const updatedAiResults = { ...visitState.aiResults, [sectionId]: result };
                        updateVisit('aiResults', updatedAiResults);
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
        const estoquePhotos = photos[SectionId.Estoque] || [];
        const industriesEstoque: string[] = visitState.industries && visitState.industries.length > 0 
          ? visitState.industries 
          : ['Veneza', 'Idealpan', 'Maricota', 'VidaVeg'];

        return (
          <div className="space-y-8 animate-in">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Check de Estoque</h2>
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{estoquePhotos.length}/30 Fotos</p>
                <div className="relative">
                  <button 
                    disabled={estoquePhotos.length >= 30}
                    className={`bg-[#E65C5C] text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-[#E65C5C]/20 ${estoquePhotos.length >= 30 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Plus size={16} /> Tirar Foto
                  </button>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && estoquePhotos.length < 30) {
                        handlePhotoCapture(SectionId.Estoque, file);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {visitState.selectedIndustry ? `Estoque: ${visitState.selectedIndustry}` : 'Quantidades por Indústria'}
                </p>
                <div className="space-y-4">
                  {industriesEstoque
                    .filter(ind => !visitState.selectedIndustry || ind === visitState.selectedIndustry)
                    .map(ind => (
                    <div key={ind} className="flex items-center justify-between gap-4">
                      <span className="font-black uppercase text-xs tracking-tight text-slate-600">{ind}</span>
                      <input 
                        type="number" 
                        placeholder="Qtd"
                        value={stockQuantities[ind] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateVisit('stockQuantities', (prev: any) => ({ ...prev, [ind]: val }));
                        }}
                        className="w-24 p-3 bg-slate-50 rounded-xl font-bold text-center border border-slate-100 focus:border-blue-500 outline-none"
                      />
                    </div>
                  ))}
                  {!visitState.selectedIndustry && (
                    <p className="text-[10px] font-bold text-[#E65C5C] uppercase text-center bg-red-50 p-4 rounded-xl">
                      Atenção: Selecione a indústria na tela "ANTES" primeiro.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {estoquePhotos.map((photo, idx) => (
                  <div key={idx} className="aspect-square bg-slate-200 rounded-2xl overflow-hidden relative group">
                    <img src={`data:image/jpeg;base64,${photo}`} className="w-full h-full object-cover" alt="Estoque" />
                    <button 
                      onClick={() => {
                        const newPhotos = estoquePhotos.filter((_, i) => i !== idx);
                        updateVisit('photos', (prev: any) => ({ ...prev, [SectionId.Estoque]: newPhotos }));
                      }}
                      className="absolute top-2 right-2 bg-white/20 backdrop-blur-md p-1 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => {
                if (!visitState.selectedIndustry) {
                  alert("Selecione uma indústria na etapa ANTES antes de salvar o estoque.");
                  navigateTo(SectionId.Antes);
                  return;
                }

                if (!isSelectedStockQuantityValid) {
                  alert(`Informe uma quantidade válida para ${selectedIndustry} antes de salvar o estoque.`);
                  return;
                }

                updateVisit('tasks', (prev: any) => ({ ...prev, [SectionId.Estoque]: true }));
                navigateTo(SectionId.Dashboard);
              }}
              className="w-full bg-[#0F172A] text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/20"
            >
              Salvar Registros de Estoque
            </button>
          </div>
        );

      case SectionId.Trocas:
        const returnsPhotos = photos[SectionId.Trocas] || [];
        return (
          <div className="space-y-8 animate-in">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Trocas e Avarias</h2>
            
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm text-center space-y-8">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
                <PackageOpen className="text-orange-500 w-10 h-10" />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-black uppercase tracking-tight">Houve trocas ou avarias{visitState.selectedIndustry ? ` (${visitState.selectedIndustry})` : ''}?</h3>
                <div className="flex gap-4 max-w-xs mx-auto">
                  <button 
                    onClick={() => updateVisit('hasReturns', true)}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${visitState.hasReturns === true ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    Sim
                  </button>
                  <button 
                    onClick={() => {
                      updateVisit('hasReturns', false);
                      updateVisit('photos', (prev: any) => ({ ...prev, [SectionId.Trocas]: [] }));
                    }}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${visitState.hasReturns === false ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    Não
                  </button>
                </div>
              </div>

              {visitState.hasReturns && (
                <div className="space-y-6 pt-6 border-t border-slate-50">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fotos das Trocas ({returnsPhotos.length}/10)</p>
                    <div className="relative">
                      <button 
                        disabled={returnsPhotos.length >= 10}
                        className={`bg-orange-500 text-white px-5 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 ${returnsPhotos.length >= 10 ? 'opacity-50' : ''}`}
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
                          if (file && returnsPhotos.length < 10) {
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
                disabled={visitState.hasReturns === null || (visitState.hasReturns === true && returnsPhotos.length === 0)}
                onClick={() => {
                  updateVisit('tasks', (prev: any) => ({ ...prev, [SectionId.Trocas]: true }));
                  navigateTo(SectionId.Dashboard);
                }}
                className={`w-full py-6 rounded-3xl font-black uppercase tracking-widest transition-all ${visitState.hasReturns !== null ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-300'}`}
              >
                Salvar e Continuar
              </button>
            </div>
          </div>
        );
      case SectionId.CheckOut:
        const checkoutPhoto = (photos[SectionId.CheckOut] || [])[0];
        return (
          <div className="space-y-8 animate-in">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Finalizar Visita</h2>
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <SummaryItem label="Check-in" value={checkInTimeDisplay} />
                <SummaryItem label="Fotos Total" value={Object.values(photos).flat().length.toString()} />
                <SummaryItem label="Tarefas" value={Object.keys(tasks).length.toString()} />
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

            {/* Log Viewer Panel */}
            <div className="w-full max-w-md bg-slate-900 rounded-3xl p-6 shadow-2xl overflow-hidden border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Log de Auditoria</h3>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500/50" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                  <div className="w-2 h-2 rounded-full bg-green-500/50" />
                </div>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto font-mono text-[10px] scrollbar-hide">
                {logs.length === 0 ? (
                  <p className="text-slate-600 italic">Aguardando início do processo...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-3 border-b border-slate-800/50 pb-2">
                      <span className="text-slate-600 shrink-0">{log.timestamp}</span>
                      <span className={
                        log.type === 'error' ? 'text-red-400' : 
                        log.type === 'success' ? 'text-emerald-400' : 
                        log.type === 'warn' ? 'text-yellow-400' : 
                        'text-slate-300'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
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

  const checkInTimeDisplay = visitState.checkInTime ? new Date(visitState.checkInTime).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit'
  }) : '--:--';

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
