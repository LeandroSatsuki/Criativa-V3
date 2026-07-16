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
  const selectedIndustry = cleanText(payload.selectedIndustry || payload.industry, 'GERAL');
  const allExecutions = Object.values(payload.industryExecutions || {}) as any[];
  const executionEntries = allExecutions.filter((execution) => (
    Object.values(execution?.photos || {}).some((photos: any) => Array.isArray(photos) && photos.length > 0)
  ));
  const hasLegacyPhotos = Object.values(payload.photos || {}).some((photos: any) => Array.isArray(photos) && photos.length > 0);

  const buildReportRow = (execution?: any) => {
    const industry = cleanText(execution?.industry || selectedIndustry, 'GERAL');
    const industryId = industry
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase() || 'GERAL';
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
    const updatedAt = getBrasiliaISO();

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
      ID_VISITA_INDUSTRIA: `${idVisita}-${industryId}`,
      QTD_FOTOS_ANTES: executionPhotos.ANTES?.length || payload.photos?.ANTES?.length || 0,
      QTD_FOTOS_DEPOIS: executionPhotos.DEPOIS?.length || payload.photos?.DEPOIS?.length || 0,
      QTD_FOTOS_TROCAS: executionPhotos.TROCAS?.length || payload.photos?.TROCAS?.length || 0,
      QTD_FOTOS_CHECKOUT: payload.photos?.CHECKOUT?.length || 0,
      STATUS_ANALISE: Object.keys(aiAfter).length > 0 ? 'CONCLUIDA' : 'PENDENTE',
      STATUS_REVISAO: 'PENDENTE',
      STATUS_RELATORIO: 'PENDENTE',
      ATUALIZADO_EM: updatedAt,
    };
  };

  const reportRows = executionEntries.length > 0
    ? executionEntries.map(buildReportRow)
    : (hasLegacyPhotos ? [buildReportRow()] : []);
  const primaryRow = reportRows.find(row => row.INDUSTRIA === selectedIndustry) || reportRows[0];
  const fallbackRow = buildReportRow();
  const resolvedPrimaryRow = primaryRow || fallbackRow;

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
    QTD_ESTOQUE: resolvedPrimaryRow.QTD_ESTOQUE,
    TEVE_TROCAS: resolvedPrimaryRow.TEVE_TROCAS,
    industry: resolvedPrimaryRow.INDUSTRIA,
    INDUSTRIA: resolvedPrimaryRow.INDUSTRIA,
    INDUSTRIAS_VISITA: reportRows.map(row => row.INDUSTRIA).join(', '),
    INDUSTRIA_MAIUSCULA: resolvedPrimaryRow.INDUSTRIA.toUpperCase(),
    industria_minuscula: resolvedPrimaryRow.INDUSTRIA.toLowerCase(),
    DATA_PASTA: fileDate,
    NOME_CHECKIN: `${storeNameClean}_${fileDate}_CHECKIN.jpg`,
    NOME_ANTES: `${storeNameClean}_${fileDate}_ANTES.jpg`,
    NOME_ESTOQUE: `${storeNameClean}_${fileDate}_ESTOQUE.jpg`,
    NOME_DEPOIS: `${storeNameClean}_${fileDate}_DEPOIS.jpg`,
    NOME_TROCA: `${storeNameClean}_${fileDate}_TROCA.jpg`,
    NOME_CHECKOUT: `${storeNameClean}_${fileDate}_CHECKOUT.jpg`,
    FOTO_CHECKIN: fotoCheckin,
    FOTO_ANTES: resolvedPrimaryRow.LINK_FOTO_ANTES,
    FOTO_ESTOQUE: resolvedPrimaryRow.LINK_FOTO_ESTOQUE,
    FOTO_DEPOIS: resolvedPrimaryRow.LINK_FOTO_DEPOIS,
    FOTO_TROCA: resolvedPrimaryRow.LINK_FOTO_TROCA,
    FOTO_CHECKOUT: fotoCheckout,
    LINK_FOTO_CHECKIN: fotoCheckin,
    LINK_FOTO_ANTES: resolvedPrimaryRow.LINK_FOTO_ANTES,
    LINK_FOTO_DEPOIS: resolvedPrimaryRow.LINK_FOTO_DEPOIS,
    LINK_FOTO_TROCA: resolvedPrimaryRow.LINK_FOTO_TROCA,
    LINK_FOTO_CHECKOUT: fotoCheckout,
    LINK_FOTO_ESTOQUE: resolvedPrimaryRow.LINK_FOTO_ESTOQUE,
    IA_ORGANIZACAO: resolvedPrimaryRow.IA_ORGANIZACAO,
    IA_STATUS_COMPLIANCE: resolvedPrimaryRow.IA_STATUS_COMPLIANCE,
    IA_RUPTURAS: resolvedPrimaryRow.IA_RUPTURAS,
    ID_VISITA_INDUSTRIA: resolvedPrimaryRow.ID_VISITA_INDUSTRIA,
    QTD_FOTOS_ANTES: resolvedPrimaryRow.QTD_FOTOS_ANTES,
    QTD_FOTOS_DEPOIS: resolvedPrimaryRow.QTD_FOTOS_DEPOIS,
    QTD_FOTOS_TROCAS: resolvedPrimaryRow.QTD_FOTOS_TROCAS,
    QTD_FOTOS_CHECKOUT: resolvedPrimaryRow.QTD_FOTOS_CHECKOUT,
    STATUS_ANALISE: resolvedPrimaryRow.STATUS_ANALISE,
    STATUS_REVISAO: resolvedPrimaryRow.STATUS_REVISAO,
    STATUS_RELATORIO: resolvedPrimaryRow.STATUS_RELATORIO,
    ATUALIZADO_EM: resolvedPrimaryRow.ATUALIZADO_EM,
    RELATORIO_VISITAS: resolvedPrimaryRow,
    RELATORIO_VISITAS_LINHAS: reportRows,
    storeId: payload.storeId,
    timestamp: getBrasiliaISO(),
  };
};

export const buildTransformedPayloads = (payload: any) => {
  const aggregatePayload = buildTransformedPayload(payload);
  const rows = Array.isArray(aggregatePayload.RELATORIO_VISITAS_LINHAS)
    ? aggregatePayload.RELATORIO_VISITAS_LINHAS
    : [];

  if (rows.length <= 1) return [aggregatePayload];

  return rows.map((row: any, index: number) => {
    const industry = row.INDUSTRIA || aggregatePayload.INDUSTRIA;
    const suffix = String(industry || 'GERAL').replace(/\s+/g, '_').toUpperCase();

    return {
      ...aggregatePayload,
      QTD_ESTOQUE: row.QTD_ESTOQUE,
      TEVE_TROCAS: row.TEVE_TROCAS,
      industry,
      INDUSTRIA: industry,
      INDUSTRIA_MAIUSCULA: String(industry || '').toUpperCase(),
      industria_minuscula: String(industry || '').toLowerCase(),
      NOME_ANTES: aggregatePayload.NOME_ANTES.replace('_ANTES.jpg', `_${suffix}_ANTES.jpg`),
      NOME_ESTOQUE: aggregatePayload.NOME_ESTOQUE.replace('_ESTOQUE.jpg', `_${suffix}_ESTOQUE.jpg`),
      NOME_DEPOIS: aggregatePayload.NOME_DEPOIS.replace('_DEPOIS.jpg', `_${suffix}_DEPOIS.jpg`),
      NOME_TROCA: aggregatePayload.NOME_TROCA.replace('_TROCA.jpg', `_${suffix}_TROCA.jpg`),
      FOTO_ANTES: row.LINK_FOTO_ANTES,
      FOTO_ESTOQUE: row.LINK_FOTO_ESTOQUE,
      FOTO_DEPOIS: row.LINK_FOTO_DEPOIS,
      FOTO_TROCA: row.LINK_FOTO_TROCA,
      LINK_FOTO_ANTES: row.LINK_FOTO_ANTES,
      LINK_FOTO_DEPOIS: row.LINK_FOTO_DEPOIS,
      LINK_FOTO_TROCA: row.LINK_FOTO_TROCA,
      LINK_FOTO_ESTOQUE: row.LINK_FOTO_ESTOQUE,
      IA_ORGANIZACAO: row.IA_ORGANIZACAO,
      IA_STATUS_COMPLIANCE: row.IA_STATUS_COMPLIANCE,
      IA_RUPTURAS: row.IA_RUPTURAS,
      ID_VISITA_INDUSTRIA: row.ID_VISITA_INDUSTRIA,
      QTD_FOTOS_ANTES: row.QTD_FOTOS_ANTES,
      QTD_FOTOS_DEPOIS: row.QTD_FOTOS_DEPOIS,
      QTD_FOTOS_TROCAS: row.QTD_FOTOS_TROCAS,
      QTD_FOTOS_CHECKOUT: row.QTD_FOTOS_CHECKOUT,
      STATUS_ANALISE: row.STATUS_ANALISE,
      STATUS_REVISAO: row.STATUS_REVISAO,
      STATUS_RELATORIO: row.STATUS_RELATORIO,
      ATUALIZADO_EM: row.ATUALIZADO_EM,
      RELATORIO_VISITAS: row,
      RELATORIO_VISITAS_LINHAS: undefined,
      LINHA_INDUSTRIA_INDICE: index + 1,
      LINHA_INDUSTRIA_TOTAL: rows.length,
    };
  });
};
