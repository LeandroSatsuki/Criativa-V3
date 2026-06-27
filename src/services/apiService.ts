import { Role, SectionId } from '../types';
import { logService } from './logService';
import { appConfig } from '../config/appConfig';

// Helper to get current time in Brasília timezone (UTC-3)
export const getBrasiliaDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * -3));
};

export const getBrasiliaISO = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(now).replace(' ', 'T');
};

const CACHE_KEY = 'CRIATIVA_APP_CACHE';

const DEFAULT_CONFIG = {
  industries: appConfig.defaultIndustries,
  promoters: [],
  stores: [],
  timestamp: null as string | null,
};

const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
};

async function fetchSheetData(sheetName: string) {
  if (!appConfig.googleSheetsId) {
    console.warn(`Google Sheets ID não configurado. Ignorando a aba ${sheetName}.`);
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const url = `https://docs.google.com/spreadsheets/d/${appConfig.googleSheetsId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    clearTimeout(timeoutId);

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("JSON não encontrado na resposta da planilha");
    }

    const jsonData = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    if (!jsonData.table) {
      throw new Error("Tabela não encontrada no JSON da planilha");
    }
    return jsonData.table;
  } catch (e: any) {
    clearTimeout(timeoutId);
    console.error(`Erro ao buscar aba ${sheetName}:`, e.message);
    return null;
  }
}

export const apiService = {
  shouldUpdate: () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return true;
      
      const { timestamp } = JSON.parse(cached);
      const lastUpdate = new Date(timestamp);
      const now = getBrasiliaDate();
      
      // Define update windows (6:00 and 19:00)
      const getWindow = (date: Date, hour: number) => {
        const d = new Date(date);
        d.setHours(hour, 0, 0, 0);
        return d;
      };

      const today06 = getWindow(now, 6);
      const today19 = getWindow(now, 19);
      
      // Determine the most recent window that has passed
      let mostRecentWindow;
      if (now >= today19) {
        mostRecentWindow = today19;
      } else if (now >= today06) {
        mostRecentWindow = today06;
      } else {
        // Most recent was 19:00 yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        mostRecentWindow = getWindow(yesterday, 19);
      }

      return lastUpdate < mostRecentWindow;
    } catch (e) {
      return true;
    }
  },
  getAppConfig: async (force = false) => {
    if (!force && !apiService.shouldUpdate()) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        (window as any)._cachedPromoters = data.promoters;
        return data;
      }

      if (!appConfig.googleSheetsId) {
        return DEFAULT_CONFIG;
      }
    }

    try {
      const industriesTable = await fetchSheetData('INDUSTRIAS');
      const promotersTable = await fetchSheetData('CADASTRO_PROMOTORES');
      const storesTable = await fetchSheetData('CADASTRO_LOJAS');
      
      const industries = industriesTable?.rows.map((row: any) => row.c[0]?.v)
        .filter((v: any) => v && v !== 'INDUSTRIAS') || [];
        
      const promoters = promotersTable?.rows.map((row: any) => ({
        id: String(row.c[0]?.v || ''),
        name: String(row.c[1]?.v || ''),
        user: String(row.c[2]?.v || '').toLowerCase().trim(),
        pass: String(row.c[3]?.v || '').toLowerCase().trim(),
        region: String(row.c[4]?.v || '')
      })).filter((p: any) => p.user && p.user !== 'usuario') || [];

      const stores = storesTable?.rows.map((row: any) => ({
        id: String(row.c[0]?.v || ''),
        name: String(row.c[1]?.v || ''),
        region: String(row.c[2]?.v || ''),
        responsible: String(row.c[11]?.v || '')
      })).filter((s: any) => s.name && s.name !== 'NOME_LOJA') || [];

      const config = {
        industries: industries.length > 0 ? industries : appConfig.defaultIndustries,
        promoters,
        stores,
        timestamp: getBrasiliaDate().toISOString()
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(config));
      (window as any)._cachedPromoters = promoters;

      return config;
    } catch (e) {
      console.error("Erro na configuração dinâmica:", e);
      // Fallback to cache if available even if error
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
      
      return DEFAULT_CONFIG;
    }
  },
  login: async (credentials: { user: string; pass: string }) => {
    const u = (credentials.user || "").toLowerCase().trim();
    const p = (credentials.pass || "").toLowerCase().trim();
    
    const promoters = (window as any)._cachedPromoters || [];
    const found = promoters.find((promoter: any) => 
      promoter.user === u && promoter.pass === p
    );

    if (found) {
      const role: Role = found.region.toUpperCase() === 'SUPERVISOR' ? 'SUPERVISOR' : 'FIELD_OPS';
      return { id: found.id, name: found.name, role: role, region: found.region, user: found.user };
    }
    throw new Error("Credenciais inválidas ou usuário não encontrado na planilha.");
  },
  getStores: async (promoterId: string) => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      let allStores = [];
      let promoters = [];

      if (cached) {
        const data = JSON.parse(cached);
        allStores = data.stores || [];
        promoters = data.promoters || [];
      } else {
        // This shouldn't happen if getAppConfig was called
        const config = await apiService.getAppConfig(true);
        allStores = config.stores || [];
        promoters = config.promoters || [];
      }

      const promoter = promoters.find((p: any) => p.id === promoterId);
      const promoterName = promoter?.name || '';
      const regional = promoter?.region || '';

      if (promoterId === '0' || regional.toUpperCase() === 'SUPERVISOR') return allStores;

      const myStores = allStores.filter((s: any) => s.responsible === promoterName);
      if (myStores.length === 0) {
        return allStores.filter((s: any) => s.region.toLowerCase().includes(regional.toLowerCase()));
      }
      return myStores;
    } catch (e) {
      console.error("Erro ao carregar lojas:", e);
      return [];
    }
  },
  syncVisit: async (payload: any, onProgress?: (msg: string) => void) => {
    const webhookUrl = appConfig.makeWebhookUrl;

    if (!webhookUrl) {
      throw new Error("VITE_MAKE_WEBHOOK_URL não configurada. Sincronização indisponível.");
    }
    
    if (onProgress) onProgress('Preparando dados para envio...');

    const photoCategories = payload.photos || {};
    
    // High-performance compression using Canvas
    const compressImage = async (base64Str: string | undefined, label: string): Promise<string> => {
      if (!base64Str) return '';
      
      // Se já for pequeno (menos de 100KB em base64), não precisa mexer
      // 100.000 caracteres base64 ~ 75KB binário
      if (base64Str.length < 100000) {
        return base64Str.includes('base64,') ? base64Str.split('base64,')[1] : base64Str;
      }

      logService.addLog(`Otimizando foto: ${label}...`, "info");
      return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str.startsWith('data:') ? base64Str : `data:image/jpeg;base64,${base64Str}`;
        
        const timeout = setTimeout(() => {
          console.warn(`⏳ Foto ${label} muito pesada, enviando versão reduzida...`);
          resolve(''); 
        }, 5000);

        img.onload = () => {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400; 
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressed = canvas.toDataURL('image/jpeg', 0.2);
            resolve(compressed.split('base64,')[1]);
          } catch (e) {
            console.error(`Erro no canvas (${label}):`, e);
            resolve('');
          }
        };
        img.onerror = () => {
          clearTimeout(timeout);
          resolve('');
        };
      });
    };

    if (onProgress) onProgress('Otimizando fotos para envio rápido...');
    logService.addLog("📸 Otimizando fotos em paralelo...", "info");

    const getPhoto = (id: string) => {
      return photoCategories[id]?.[0] || 
             photoCategories[id.toUpperCase()]?.[0] || 
             photoCategories[id.toLowerCase()]?.[0];
    };

    // Compress all photos in parallel to save time
    const photoPromises = [
      compressImage(getPhoto(SectionId.Facade) || getPhoto('FACHADA'), 'Check-in'),
      compressImage(getPhoto(SectionId.Antes) || getPhoto('ANTES'), 'Antes'),
      compressImage(getPhoto(SectionId.Estoque) || getPhoto('ESTOQUE'), 'Estoque'),
      compressImage(getPhoto(SectionId.Depois) || getPhoto('DEPOIS'), 'Depois'),
      compressImage(getPhoto(SectionId.Trocas) || getPhoto('TROCAS'), 'Trocas'),
      compressImage(getPhoto(SectionId.CheckOut) || getPhoto('CHECKOUT'), 'Check-out')
    ];

    const [
      checkInPhoto, 
      beforePhoto, 
      stockPhoto, 
      afterPhoto, 
      exchangePhoto, 
      checkOutPhoto
    ] = await Promise.all(photoPromises);

    const compressedPhotos = {
      checkIn: checkInPhoto,
      before: beforePhoto,
      stock: stockPhoto,
      after: afterPhoto,
      exchange: exchangePhoto,
      checkOut: checkOutPhoto
    };

    logService.addLog("📦 Fotos otimizadas. Montando pacote final...", "info");

    const cleanText = (text: string | undefined, fallback: string) => {
      if (!text) return fallback;
      const cleaned = text.trim();
      return (cleaned === '' || cleaned === '.') ? fallback : cleaned;
    };

    const formatBrasiliaTime = (dateStr: string | undefined) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleTimeString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatBrasiliaDate = (dateStr: string | undefined) => {
      const date = dateStr ? new Date(dateStr) : new Date();
      return date.toLocaleDateString('pt-BR', { 
        timeZone: 'America/Sao_Paulo' 
      });
    };

    const checkIn = payload.checkInTime ? new Date(payload.checkInTime) : null;
    const checkOut = payload.checkOutTime ? new Date(payload.checkOutTime) : new Date();
    let duration = "";
    if (checkIn) {
      const diff = checkOut.getTime() - checkIn.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      duration = `${hours}h ${minutes}m`;
    }

    const aiAfter = payload.aiResults?.['DEPOIS'] || {};

    const formatFileDate = (dateStr: string | undefined) => {
      const date = dateStr ? new Date(dateStr) : new Date();
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}-${m}-${y}`;
    };

    const fileDate = formatFileDate(payload.timestamp || payload.checkInTime);
    const rawStoreName = payload.currentStore || 'LOJA';
    const storeNameClean = cleanText(rawStoreName, 'LOJA').replace(/\s+/g, '_').toUpperCase();
    const selectedIndustry = cleanText(payload.selectedIndustry || payload.industry, 'GERAL');

    const transformedPayload = {
      DATA_VISITA: formatBrasiliaDate(payload.timestamp || payload.checkInTime),
      ID_VISITA: generateId('VISIT'),
      NOME_PROMOTOR: cleanText(payload.user?.name, 'Promotor'),
      NOME_LOJA: cleanText(payload.currentStore, 'Loja'),
      HORA_ENTRADA_CHECK_IN: formatBrasiliaTime(payload.checkInTime),
      HORA_SAIDA_CHECK_OUT: formatBrasiliaTime(payload.checkOutTime),
      TEMPO_PERMANENCIA: duration,
      QTD_ESTOQUE: String(payload.stockQuantities?.[payload.selectedIndustry || ''] || '0'),
      TEVE_TROCAS: payload.hasReturns ? 'SIM' : 'NÃO',
      industry: selectedIndustry, // Original (ex: Veneza)
      INDUSTRIA: selectedIndustry, // Redundância
      INDUSTRIA_MAIUSCULA: selectedIndustry.toUpperCase(), // Para filtros antigos
      industria_minuscula: selectedIndustry.toLowerCase(), // Para segurança
      DATA_PASTA: fileDate,
      NOME_CHECKIN: `${storeNameClean}_${fileDate}_CHECKIN.jpg`,
      NOME_ANTES: `${storeNameClean}_${fileDate}_ANTES.jpg`,
      NOME_ESTOQUE: `${storeNameClean}_${fileDate}_ESTOQUE.jpg`,
      NOME_DEPOIS: `${storeNameClean}_${fileDate}_DEPOIS.jpg`,
      NOME_TROCA: `${storeNameClean}_${fileDate}_TROCA.jpg`,
      NOME_CHECKOUT: `${storeNameClean}_${fileDate}_CHECKOUT.jpg`,
      FOTO_CHECKIN: compressedPhotos.checkIn,
      FOTO_ANTES: compressedPhotos.before,
      FOTO_ESTOQUE: compressedPhotos.stock,
      FOTO_DEPOIS: compressedPhotos.after,
      FOTO_TROCA: compressedPhotos.exchange,
      FOTO_CHECKOUT: compressedPhotos.checkOut,
      IA_ORGANIZACAO: aiAfter.organization || '',
      IA_STATUS_COMPLIANCE: aiAfter.complianceStatus || '',
      IA_RUPTURAS: aiAfter.ruptures || '',
      storeId: payload.storeId,
      timestamp: getBrasiliaISO()
    };

    if (onProgress) onProgress('Enviando dados para o Make...');

    const payloadString = JSON.stringify(transformedPayload);
    logService.addLog("🚀 Iniciando Sincronização...", "info");
    logService.addLog(`🆔 ID da Visita: ${transformedPayload.ID_VISITA}`, "info");
    logService.addLog(`📦 Tamanho do Payload: ${(payloadString.length / 1024).toFixed(2)} KB`, "info");
    
    try {
      const industryName = transformedPayload.industry || 'Indústria não identificada';
      logService.addLog(`🏭 Destino: ${industryName}`, "info");
    } catch (e) {
      logService.addLog("⚠️ Erro ao ler nome da indústria", "warn");
    }
    
    logService.addLog("📡 Conectando ao Webhook e enviando dados...", "info");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logService.addLog("⚠️ O tempo de espera excedeu 5 minutos. Abortando...", "warn");
      controller.abort();
    }, 300000); 

    try {
      const startTime = Date.now();
      logService.addLog("⏳ Aguardando confirmação do Make.com...", "info");
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: payloadString,
        signal: controller.signal
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      clearTimeout(timeoutId);
      
      logService.addLog(`📡 Resposta do Servidor (${duration}s): ${response.status} ${response.statusText}`, "info");
      
      if (!response.ok) {
        const errorText = await response.text();
        logService.addLog(`❌ Erro do servidor Make: ${response.status} - ${errorText || 'Sem detalhes'}`, "error");
        throw new Error(`Falha na sincronização: ${response.status} ${response.statusText}. Detalhe: ${errorText}`);
      }
      
      logService.addLog("🎉 Sincronização concluída com sucesso!", "success");
      return { visitId: generateId('SYNC') };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logService.addLog("❌ Tempo de espera esgotado (Timeout de 5min)", "error");
        logService.addLog("Dica: Verifique se o módulo 'Webhook Response' está logo no início do cenário no Make.", "info");
        throw new Error("O envio demorou demais (timeout). Verifique sua conexão ou se o Make.com está respondendo.");
      }
      logService.addLog(`❌ Falha no envio: ${fetchError.message}`, "error");
      throw new Error(`Erro de conexão com o Make: ${fetchError.message}. Verifique se o Webhook no Make está ATIVO (ON).`);
    }
  },
  pingMake: async () => {
    const webhookUrl = appConfig.makeWebhookUrl;

    if (!webhookUrl) {
      throw new Error("VITE_MAKE_WEBHOOK_URL não configurada. Teste de conexão indisponível.");
    }
    // Envia um "Gabarito" completo para o Make aprender todos os campos sem precisar de fotos reais
    const templatePayload = {
      DATA_VISITA: "20/03/2026",
      ID_VISITA: "TEST-TEMPLATE",
      NOME_PROMOTOR: "PROMOTOR TESTE",
      NOME_LOJA: "LOJA TESTE",
      HORA_ENTRADA_CHECK_IN: "08:00",
      HORA_SAIDA_CHECK_OUT: "09:00",
      TEMPO_PERMANENCIA: "1h 0m",
      QTD_ESTOQUE: "10",
      TEVE_TROCAS: "NÃO",
      industry: "Veneza",
      INDUSTRIA: "Veneza",
      INDUSTRIA_MAIUSCULA: "VENEZA",
      industria_minuscula: "veneza",
      DATA_PASTA: "20-03-2026",
      NOME_CHECKIN: "TESTE_CHECKIN.jpg",
      NOME_ANTES: "TESTE_ANTES.jpg",
      NOME_ESTOQUE: "TESTE_ESTOQUE.jpg",
      NOME_DEPOIS: "TESTE_DEPOIS.jpg",
      NOME_TROCA: "TESTE_TROCA.jpg",
      NOME_CHECKOUT: "TESTE_CHECKOUT.jpg",
      FOTO_CHECKIN: "base64_dummy_data",
      FOTO_ANTES: "base64_dummy_data",
      FOTO_ESTOQUE: "base64_dummy_data",
      FOTO_DEPOIS: "base64_dummy_data",
      FOTO_TROCA: "base64_dummy_data",
      FOTO_CHECKOUT: "base64_dummy_data",
      IA_ORGANIZACAO: "Boa",
      IA_STATUS_COMPLIANCE: "Conforme",
      IA_RUPTURAS: "Nenhuma",
      storeId: "123",
      timestamp: new Date().toISOString(),
      test_mode: true
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  },
  getSupervisorDashboard: async () => {
    // This would ideally fetch from a 'VISITAS' sheet, but for now we use the dynamic promoters list
    const promoters = (window as any)._cachedPromoters || [];
    return promoters.map((p: any) => ({
      id: p.id,
      name: p.name,
      region: p.region,
      status: Math.random() > 0.5 ? 'EM ANDAMENTO' : 'PENDENTE',
      online: Math.random() > 0.3,
      progress: Math.floor(Math.random() * 100),
      store: 'Loja Exemplo',
      lastSync: '10:30'
    }));
  },
  getPromoterExecution: async (id: string) => {
    return {
      metrics: { efficiency: '92%', workingTime: '06:45h' },
      route: [
        { id: '1', name: 'Loja A', time: '08:00', status: 'CONCLUÍDO', tasks: 5, photos: 12 },
        { id: '2', name: 'Loja B', time: '10:30', status: 'EM ANDAMENTO', tasks: 2, photos: 4 }
      ]
    };
  }
};
