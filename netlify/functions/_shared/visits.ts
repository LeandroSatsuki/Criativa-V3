import { getJsonStore } from './storage';
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
    body?: string;
  } | null;
};

const visitStore = getJsonStore('criativa-visits');

const keyFor = (visitId: string) => `visits/${visitId}`;

export const generateVisitId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `VISIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `VISIT-${Date.now().toString(36).toUpperCase()}`;
};

export const getVisit = async (visitId: string) => {
  return visitStore.get<VisitRecord>(keyFor(visitId));
};

export const saveVisit = async (record: VisitRecord) => {
  await visitStore.set(keyFor(record.visitId), record);
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
  const keys = await visitStore.list('visits/');
  const visits = await Promise.all(
    keys.map(async (key) => visitStore.get<VisitRecord>(key)),
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
  const fileDate = formatFileDate(payload.timestamp || payload.checkInTime);
  const dataVisita = formatBrasiliaDate(payload.timestamp || payload.checkInTime);
  const idVisita = payload.visitId || generateVisitId();
  const nomePromotor = cleanText(payload.user?.name, 'Promotor');
  const nomeLoja = cleanText(payload.currentStore, 'Loja');
  const horaEntrada = formatBrasiliaTime(payload.checkInTime);
  const horaSaida = formatBrasiliaTime(payload.checkOutTime);
  const fotoCheckin = payload.photos?.FACHADA?.[0] || '';
  const fotoCheckout = payload.photos?.CHECKOUT?.[0] || '';
  const executionEntries = Object.values(payload.industryExecutions || {}) as any[];
  const selectedIndustry = cleanText(payload.selectedIndustry || payload.industry, 'GERAL');

  const buildReportRow = (execution?: any) => {
    const industry = cleanText(execution?.industry || selectedIndustry, 'GERAL');
    const executionPhotos = execution?.photos || {};
    const executionStock = execution?.stockQuantities || {};
    const aiAfter = execution?.aiResults?.['DEPOIS'] || payload.aiResults?.['DEPOIS'] || {};
    const qtdEstoque = String(executionStock[industry] || payload.stockQuantities?.[industry] || '0');
    const teveTrocas = (execution?.hasReturns ?? payload.hasReturns) ? 'SIM' : 'NÃO';
    const fotoAntes = executionPhotos.ANTES?.[0] || payload.photos?.ANTES?.[0] || '';
    const fotoEstoque = executionPhotos.ESTOQUE?.[0] || payload.photos?.ESTOQUE?.[0] || '';
    const fotoDepois = executionPhotos.DEPOIS?.[0] || payload.photos?.DEPOIS?.[0] || '';
    const fotoTroca = executionPhotos.TROCAS?.[0] || payload.photos?.TROCAS?.[0] || '';
    const iaOrganizacao = aiAfter.organization || '';
    const iaStatusCompliance = aiAfter.complianceStatus || '';
    const iaRupturas = aiAfter.ruptures || '';

    return {
      DATA_VISITA: dataVisita,
      ID_VISITA: idVisita,
      NOME_PROMOTOR: nomePromotor,
      NOME_LOJA: nomeLoja,
      'HORA_ENTRADA_CHECK-IN': horaEntrada,
      'HORA_SAIDA_CHECK-OUT': horaSaida,
      TEMPO_PERMANENCIA: duration,
      QTD_ESTOQUE: qtdEstoque,
      TEVE_TROCAS: teveTrocas,
      INDUSTRIA: industry,
      LINK_FOTO_CHECKIN: fotoCheckin,
      LINK_FOTO_ANTES: fotoAntes,
      LINK_FOTO_DEPOIS: fotoDepois,
      LINK_FOTO_TROCA: fotoTroca,
      LINK_FOTO_CHECKOUT: fotoCheckout,
      IA_ORGANIZACAO: iaOrganizacao,
      IA_STATUS_COMPLIANCE: iaStatusCompliance,
      IA_RUPTURAS: iaRupturas,
      LINK_FOTO_ESTOQUE: fotoEstoque,
    };
  };

  const reportRows = executionEntries.length > 0
    ? executionEntries.map(buildReportRow)
    : [buildReportRow()];
  const primaryRow = reportRows.find(row => row.INDUSTRIA === selectedIndustry) || reportRows[0];

  return {
    DATA_VISITA: dataVisita,
    ID_VISITA: idVisita,
    NOME_PROMOTOR: nomePromotor,
    NOME_LOJA: nomeLoja,
    HORA_ENTRADA_CHECK_IN: horaEntrada,
    'HORA_ENTRADA_CHECK-IN': horaEntrada,
    HORA_SAIDA_CHECK_OUT: horaSaida,
    'HORA_SAIDA_CHECK-OUT': horaSaida,
    TEMPO_PERMANENCIA: duration,
    QTD_ESTOQUE: primaryRow.QTD_ESTOQUE,
    TEVE_TROCAS: primaryRow.TEVE_TROCAS,
    industry: primaryRow.INDUSTRIA,
    INDUSTRIA: primaryRow.INDUSTRIA,
    INDUSTRIAS_VISITA: reportRows.map(row => row.INDUSTRIA).join(', '),
    INDUSTRIA_MAIUSCULA: primaryRow.INDUSTRIA.toUpperCase(),
    industria_minuscula: primaryRow.INDUSTRIA.toLowerCase(),
    DATA_PASTA: fileDate,
    NOME_CHECKIN: `${storeNameClean}_${fileDate}_CHECKIN.jpg`,
    NOME_ANTES: `${storeNameClean}_${fileDate}_ANTES.jpg`,
    NOME_ESTOQUE: `${storeNameClean}_${fileDate}_ESTOQUE.jpg`,
    NOME_DEPOIS: `${storeNameClean}_${fileDate}_DEPOIS.jpg`,
    NOME_TROCA: `${storeNameClean}_${fileDate}_TROCA.jpg`,
    NOME_CHECKOUT: `${storeNameClean}_${fileDate}_CHECKOUT.jpg`,
    FOTO_CHECKIN: fotoCheckin,
    FOTO_ANTES: primaryRow.LINK_FOTO_ANTES,
    FOTO_ESTOQUE: primaryRow.LINK_FOTO_ESTOQUE,
    FOTO_DEPOIS: primaryRow.LINK_FOTO_DEPOIS,
    FOTO_TROCA: primaryRow.LINK_FOTO_TROCA,
    FOTO_CHECKOUT: fotoCheckout,
    LINK_FOTO_CHECKIN: fotoCheckin,
    LINK_FOTO_ANTES: primaryRow.LINK_FOTO_ANTES,
    LINK_FOTO_DEPOIS: primaryRow.LINK_FOTO_DEPOIS,
    LINK_FOTO_TROCA: primaryRow.LINK_FOTO_TROCA,
    LINK_FOTO_CHECKOUT: fotoCheckout,
    LINK_FOTO_ESTOQUE: primaryRow.LINK_FOTO_ESTOQUE,
    IA_ORGANIZACAO: primaryRow.IA_ORGANIZACAO,
    IA_STATUS_COMPLIANCE: primaryRow.IA_STATUS_COMPLIANCE,
    IA_RUPTURAS: primaryRow.IA_RUPTURAS,
    RELATORIO_VISITAS: primaryRow,
    RELATORIO_VISITAS_LINHAS: reportRows,
    storeId: payload.storeId,
    timestamp: getBrasiliaISO(),
  };
};
