import { getStore } from '@netlify/blobs';
import { getBrasiliaISO, formatBrasiliaDate, formatBrasiliaTime, formatFileDate } from './time';

export type VisitRecord = {
  visitId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pendente' | 'enviando' | 'enviado' | 'erro' | 'reenviar';
  syncError?: string | null;
  payload: any;
  makeResponse?: {
    status: number;
    ok: boolean;
  } | null;
};

const visitStore = getStore({ name: 'criativa-visits', consistency: 'strong' });

const keyFor = (visitId: string) => `visits/${visitId}`;

export const generateVisitId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `VISIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `VISIT-${Date.now().toString(36).toUpperCase()}`;
};

export const getVisit = async (visitId: string) => {
  return visitStore.get(keyFor(visitId), { type: 'json' }) as Promise<VisitRecord | null>;
};

export const saveVisit = async (record: VisitRecord) => {
  await visitStore.setJSON(keyFor(record.visitId), record);
  return record;
};

export const upsertVisit = async (payload: any, syncStatus: VisitRecord['syncStatus'] = 'pendente') => {
  const visitId = payload.visitId || generateVisitId();
  const previous = await getVisit(visitId);
  const now = getBrasiliaISO();

  const record: VisitRecord = {
    visitId,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    syncStatus,
    syncError: previous?.syncError || null,
    makeResponse: previous?.makeResponse || null,
    payload: {
      ...(previous?.payload || {}),
      ...payload,
      visitId,
      updatedAt: now,
    },
  };

  await saveVisit(record);
  return record;
};

export const updateVisit = async (visitId: string, patch: any) => {
  const previous = await getVisit(visitId);
  const now = getBrasiliaISO();

  const record: VisitRecord = {
    visitId,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    syncStatus: patch.syncStatus || previous?.syncStatus || 'pendente',
    syncError: patch.syncError ?? previous?.syncError ?? null,
    makeResponse: patch.makeResponse || previous?.makeResponse || null,
    payload: {
      ...(previous?.payload || {}),
      ...(patch.payload || patch),
      visitId,
      updatedAt: now,
    },
  };

  await saveVisit(record);
  return record;
};

export const listVisits = async () => {
  const { blobs } = await visitStore.list({ prefix: 'visits/' });
  const visits = await Promise.all(
    blobs.map(async (blob) => visitStore.get(blob.key, { type: 'json' }) as Promise<VisitRecord | null>),
  );
  return visits.filter(Boolean) as VisitRecord[];
};

export const buildTransformedPayload = (payload: any) => {
  const checkIn = payload.checkInTime ? new Date(payload.checkInTime) : null;
  const checkOut = payload.checkOutTime ? new Date(payload.checkOutTime) : new Date();
  let duration = '';

  if (checkIn) {
    const diff = checkOut.getTime() - checkIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    duration = `${hours}h ${minutes}m`;
  }

  const cleanText = (text: string | undefined, fallback: string) => {
    if (!text) return fallback;
    const cleaned = text.trim();
    return (cleaned === '' || cleaned === '.') ? fallback : cleaned;
  };

  const storeNameClean = cleanText(payload.currentStore || 'LOJA', 'LOJA').replace(/\s+/g, '_').toUpperCase();
  const selectedIndustry = cleanText(payload.selectedIndustry || payload.industry, 'GERAL');
  const fileDate = formatFileDate(payload.timestamp || payload.checkInTime);
  const aiAfter = payload.aiResults?.['DEPOIS'] || {};

  return {
    DATA_VISITA: formatBrasiliaDate(payload.timestamp || payload.checkInTime),
    ID_VISITA: payload.visitId || generateVisitId(),
    NOME_PROMOTOR: cleanText(payload.user?.name, 'Promotor'),
    NOME_LOJA: cleanText(payload.currentStore, 'Loja'),
    HORA_ENTRADA_CHECK_IN: formatBrasiliaTime(payload.checkInTime),
    HORA_SAIDA_CHECK_OUT: formatBrasiliaTime(payload.checkOutTime),
    TEMPO_PERMANENCIA: duration,
    QTD_ESTOQUE: String(payload.stockQuantities?.[payload.selectedIndustry || ''] || '0'),
    TEVE_TROCAS: payload.hasReturns ? 'SIM' : 'NÃO',
    industry: selectedIndustry,
    INDUSTRIA: selectedIndustry,
    INDUSTRIA_MAIUSCULA: selectedIndustry.toUpperCase(),
    industria_minuscula: selectedIndustry.toLowerCase(),
    DATA_PASTA: fileDate,
    NOME_CHECKIN: `${storeNameClean}_${fileDate}_CHECKIN.jpg`,
    NOME_ANTES: `${storeNameClean}_${fileDate}_ANTES.jpg`,
    NOME_ESTOQUE: `${storeNameClean}_${fileDate}_ESTOQUE.jpg`,
    NOME_DEPOIS: `${storeNameClean}_${fileDate}_DEPOIS.jpg`,
    NOME_TROCA: `${storeNameClean}_${fileDate}_TROCA.jpg`,
    NOME_CHECKOUT: `${storeNameClean}_${fileDate}_CHECKOUT.jpg`,
    FOTO_CHECKIN: payload.photos?.FACHADA?.[0] || '',
    FOTO_ANTES: payload.photos?.ANTES?.[0] || '',
    FOTO_ESTOQUE: payload.photos?.ESTOQUE?.[0] || '',
    FOTO_DEPOIS: payload.photos?.DEPOIS?.[0] || '',
    FOTO_TROCA: payload.photos?.TROCAS?.[0] || '',
    FOTO_CHECKOUT: payload.photos?.CHECKOUT?.[0] || '',
    IA_ORGANIZACAO: aiAfter.organization || '',
    IA_STATUS_COMPLIANCE: aiAfter.complianceStatus || '',
    IA_RUPTURAS: aiAfter.ruptures || '',
    storeId: payload.storeId,
    timestamp: getBrasiliaISO(),
  };
};
