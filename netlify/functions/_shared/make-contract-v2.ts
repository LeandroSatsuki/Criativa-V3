import { createHash } from 'node:crypto';
import { formatBrasiliaDate, formatBrasiliaTime, formatFileDate, getBrasiliaISO } from './time.ts';

export const MAKE_CONTRACT_VERSION = '2.0';
export const MAKE_PHOTOS_PER_RUN = 3;

export type PhotoStage = 'FACHADA' | 'ANTES' | 'ESTOQUE' | 'DEPOIS' | 'TROCAS' | 'CHECKOUT';

export type MakePhotoEvent = {
  CONTRACT_VERSION: string;
  EVENT_TYPE: 'PHOTO_UPLOAD';
  EVENT_ID: string;
  IDEMPOTENCY_KEY: string;
  ID_VISITA: string;
  ID_FOTO: string;
  ETAPA: PhotoStage;
  INDUSTRIA: string;
  ORDEM: number;
  NOME_ARQUIVO: string;
  MIME_TYPE: 'image/jpeg';
  TAMANHO_BYTES: number;
  FOTO_BASE64: string;
  PASTA_VISITA_NOME: string;
  NOME_LOJA: string;
  NOME_PROMOTOR: string;
  ROW_WRITE: false;
};

export type DrivePhotoReceipt = {
  eventId: string;
  photoId: string;
  stage: PhotoStage;
  industry: string;
  order: number;
  fileName: string;
  fileId: string;
  fileUrl: string;
  folderId?: string;
  folderUrl?: string;
  syncedAt: string;
};

export type DriveSyncManifest = {
  contractVersion: string;
  totalPhotos: number;
  photos: Record<string, DrivePhotoReceipt>;
  folderId?: string;
  folderUrl?: string;
  finalizedAt?: string;
  rowAction?: 'created' | 'updated';
  rowId?: string;
};

export type MakeVisitFinalizeEvent = {
  CONTRACT_VERSION: string;
  EVENT_TYPE: 'VISIT_FINALIZE';
  EVENT_ID: string;
  IDEMPOTENCY_KEY: string;
  ROW_MODE: 'UPSERT_BY_ID_VISITA';
  ID_VISITA: string;
  DATA_VISITA: string;
  NOME_PROMOTOR: string;
  NOME_LOJA: string;
  'HORA_ENTRADA_CHECK-IN': string;
  'HORA_SAIDA_CHECK-OUT': string;
  TEMPO_PERMANENCIA: string;
  QTD_ESTOQUE: string;
  TEVE_TROCAS: 'SIM' | 'NÃO';
  LINK_FOTO_CHECKIN: string;
  LINK_FOTO_ANTES: '';
  LINK_FOTO_DEPOIS: '';
  LINK_FOTO_TROCA: '';
  LINK_FOTO_CHECKOUT: '';
  LINK_FOTO_ESTOQUE: '';
  IA_ORGANIZACAO: string;
  IA_STATUS_COMPLIANCE: string;
  IA_RUPTURAS: string;
  VERSAO_CONTRATO: string;
  INDUSTRIAS_VISITA: string;
  ESTOQUE_POR_INDUSTRIA: string;
  TROCAS_POR_INDUSTRIA: string;
  QTD_FOTOS_ANTES: number;
  QTD_FOTOS_DEPOIS: number;
  QTD_FOTOS_TROCAS: number;
  QTD_FOTOS_CHECKOUT: number;
  TOTAL_FOTOS: number;
  PASTA_FOTOS_DRIVE_URL: string;
  STATUS_UPLOAD_FOTOS: 'CONCLUIDO';
  STATUS_ANALISE: 'PENDENTE' | 'CONCLUIDA';
  STATUS_REVISAO: 'PENDENTE';
  STATUS_RELATORIO: 'PENDENTE';
  ATUALIZADO_EM: string;
};

type PhotoCandidate = {
  stage: PhotoStage;
  industry: string;
  base64: string;
};

const normalizeText = (value: unknown, fallback: string) => {
  const normalized = String(value || '').trim();
  return normalized && normalized !== '.' ? normalized : fallback;
};

const safeName = (value: unknown, fallback: string) => normalizeText(value, fallback)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toUpperCase() || fallback;

const hashPhoto = (base64: string) => createHash('sha256').update(base64).digest('hex');

const calculateDuration = (checkInValue: unknown, checkOutValue: unknown) => {
  if (!checkInValue) return '';
  const checkIn = new Date(String(checkInValue));
  const checkOut = checkOutValue ? new Date(String(checkOutValue)) : new Date();
  const diff = Math.max(0, checkOut.getTime() - checkIn.getTime());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const getExecutionEntries = (payload: any) => Object.values(payload.industryExecutions || {})
  .filter(Boolean) as any[];

const addCandidates = (
  candidates: PhotoCandidate[],
  photos: unknown,
  stage: PhotoStage,
  industry: string,
) => {
  if (!Array.isArray(photos)) return;
  photos.forEach((photo) => {
    if (typeof photo === 'string' && photo.trim()) {
      candidates.push({ stage, industry, base64: photo });
    }
  });
};

const collectPhotoCandidates = (payload: any) => {
  const candidates: PhotoCandidate[] = [];
  const selectedIndustry = normalizeText(payload.selectedIndustry || payload.industry, 'GERAL');
  const executions = getExecutionEntries(payload);

  addCandidates(candidates, payload.photos?.FACHADA, 'FACHADA', 'GERAL');
  addCandidates(candidates, payload.photos?.CHECKOUT, 'CHECKOUT', 'GERAL');

  executions
    .sort((left, right) => String(left.industry || '').localeCompare(String(right.industry || ''), 'pt-BR'))
    .forEach((execution) => {
      const industry = normalizeText(execution.industry, selectedIndustry);
      addCandidates(candidates, execution.photos?.ANTES, 'ANTES', industry);
      addCandidates(candidates, execution.photos?.ESTOQUE, 'ESTOQUE', industry);
      addCandidates(candidates, execution.photos?.DEPOIS, 'DEPOIS', industry);
      addCandidates(candidates, execution.photos?.TROCAS, 'TROCAS', industry);

      if (!execution.photos?.TROCAS?.length) {
        addCandidates(candidates, payload.returnsPhotosByIndustry?.[industry], 'TROCAS', industry);
      }
    });

  (['ANTES', 'ESTOQUE', 'DEPOIS', 'TROCAS'] as PhotoStage[]).forEach((stage) => {
    if (!candidates.some((candidate) => candidate.stage === stage)) {
      addCandidates(candidates, payload.photos?.[stage], stage, selectedIndustry);
    }
  });

  const unique = new Map<string, PhotoCandidate>();
  candidates.forEach((candidate) => {
    const key = `${candidate.stage}|${safeName(candidate.industry, 'GERAL')}|${hashPhoto(candidate.base64)}`;
    if (!unique.has(key)) unique.set(key, candidate);
  });
  return Array.from(unique.values());
};

export const buildMakePhotoEvents = (payload: any): MakePhotoEvent[] => {
  const visitId = normalizeText(payload.visitId, 'VISIT-SEM-ID');
  const fileDate = formatFileDate(payload.timestamp || payload.checkInTime);
  const storeName = normalizeText(payload.currentStore, 'Loja');
  const promoterName = normalizeText(payload.user?.name, 'Promotor');
  const storeSlug = safeName(storeName, 'LOJA');
  const visitFolderName = `${storeSlug}_${fileDate}_${safeName(visitId, 'VISITA')}`;
  const stageCounts = new Map<string, number>();

  return collectPhotoCandidates(payload).map((candidate) => {
    const industrySlug = safeName(candidate.industry, 'GERAL');
    const countKey = `${industrySlug}|${candidate.stage}`;
    const order = (stageCounts.get(countKey) || 0) + 1;
    stageCounts.set(countKey, order);
    const hash = hashPhoto(candidate.base64);
    const photoId = createHash('sha256')
      .update(`${visitId}|${candidate.stage}|${industrySlug}|${order}|${hash}`)
      .digest('hex')
      .slice(0, 32);
    const fileName = `${storeSlug}_${fileDate}_${industrySlug}_${candidate.stage}_${String(order).padStart(2, '0')}_${hash.slice(0, 8)}.jpg`;

    return {
      CONTRACT_VERSION: MAKE_CONTRACT_VERSION,
      EVENT_TYPE: 'PHOTO_UPLOAD',
      EVENT_ID: `${visitId}:PHOTO:${photoId}`,
      IDEMPOTENCY_KEY: photoId,
      ID_VISITA: visitId,
      ID_FOTO: photoId,
      ETAPA: candidate.stage,
      INDUSTRIA: candidate.industry,
      ORDEM: order,
      NOME_ARQUIVO: fileName,
      MIME_TYPE: 'image/jpeg',
      TAMANHO_BYTES: Buffer.byteLength(candidate.base64, 'base64'),
      FOTO_BASE64: candidate.base64,
      PASTA_VISITA_NOME: visitFolderName,
      NOME_LOJA: storeName,
      NOME_PROMOTOR: promoterName,
      ROW_WRITE: false,
    };
  });
};

const getIndustries = (payload: any) => {
  const fromExecutions = getExecutionEntries(payload)
    .map((execution) => normalizeText(execution.industry, ''))
    .filter(Boolean);
  const fallback = normalizeText(payload.selectedIndustry || payload.industry, 'GERAL');
  return Array.from(new Set(fromExecutions.length ? fromExecutions : [fallback]))
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
};

const getStockByIndustry = (payload: any) => {
  const stock: Record<string, Record<string, string>> = {};
  getExecutionEntries(payload).forEach((execution) => {
    const industry = normalizeText(execution.industry, 'GERAL');
    stock[industry] = execution.stockQuantities || {};
  });
  if (!Object.keys(stock).length && payload.stockQuantities) {
    stock[normalizeText(payload.selectedIndustry || payload.industry, 'GERAL')] = payload.stockQuantities;
  }
  return stock;
};

const getReturnsByIndustry = (payload: any) => {
  const returns: Record<string, 'SIM' | 'NÃO'> = {};
  getExecutionEntries(payload).forEach((execution) => {
    const industry = normalizeText(execution.industry, 'GERAL');
    returns[industry] = execution.hasReturns ? 'SIM' : 'NÃO';
  });
  if (!Object.keys(returns).length) {
    returns[normalizeText(payload.selectedIndustry || payload.industry, 'GERAL')] = payload.hasReturns ? 'SIM' : 'NÃO';
  }
  return returns;
};

export const buildMakeVisitFinalizeEvent = (
  payload: any,
  events: MakePhotoEvent[],
  manifest: DriveSyncManifest,
): MakeVisitFinalizeEvent => {
  const visitId = normalizeText(payload.visitId, 'VISIT-SEM-ID');
  const industries = getIndustries(payload);
  const stockByIndustry = getStockByIndustry(payload);
  const returnsByIndustry = getReturnsByIndustry(payload);
  const aiResults = getExecutionEntries(payload)
    .map((execution) => execution.aiResults?.DEPOIS)
    .filter(Boolean);
  const checkInReceipt = Object.values(manifest.photos).find((photo) => photo.stage === 'FACHADA');
  const countStage = (stage: PhotoStage) => events.filter((event) => event.ETAPA === stage).length;

  return {
    CONTRACT_VERSION: MAKE_CONTRACT_VERSION,
    EVENT_TYPE: 'VISIT_FINALIZE',
    EVENT_ID: `${visitId}:FINALIZE`,
    IDEMPOTENCY_KEY: visitId,
    ROW_MODE: 'UPSERT_BY_ID_VISITA',
    ID_VISITA: visitId,
    DATA_VISITA: formatBrasiliaDate(payload.timestamp || payload.checkInTime),
    NOME_PROMOTOR: normalizeText(payload.user?.name, 'Promotor'),
    NOME_LOJA: normalizeText(payload.currentStore, 'Loja'),
    'HORA_ENTRADA_CHECK-IN': formatBrasiliaTime(payload.checkInTime),
    'HORA_SAIDA_CHECK-OUT': formatBrasiliaTime(payload.checkOutTime),
    TEMPO_PERMANENCIA: calculateDuration(payload.checkInTime, payload.checkOutTime),
    QTD_ESTOQUE: String(Object.values(stockByIndustry).reduce((total, values) => (
      total + Object.values(values).reduce((sum, value) => sum + (Number(value) || 0), 0)
    ), 0)),
    TEVE_TROCAS: Object.values(returnsByIndustry).includes('SIM') ? 'SIM' : 'NÃO',
    LINK_FOTO_CHECKIN: checkInReceipt?.fileUrl || '',
    LINK_FOTO_ANTES: '',
    LINK_FOTO_DEPOIS: '',
    LINK_FOTO_TROCA: '',
    LINK_FOTO_CHECKOUT: '',
    LINK_FOTO_ESTOQUE: '',
    IA_ORGANIZACAO: aiResults.map((result) => result.organization).filter(Boolean).join(' | '),
    IA_STATUS_COMPLIANCE: aiResults.map((result) => result.complianceStatus).filter(Boolean).join(' | '),
    IA_RUPTURAS: aiResults.map((result) => result.ruptures).filter(Boolean).join(' | '),
    VERSAO_CONTRATO: MAKE_CONTRACT_VERSION,
    INDUSTRIAS_VISITA: industries.join(', '),
    ESTOQUE_POR_INDUSTRIA: JSON.stringify(stockByIndustry),
    TROCAS_POR_INDUSTRIA: JSON.stringify(returnsByIndustry),
    QTD_FOTOS_ANTES: countStage('ANTES'),
    QTD_FOTOS_DEPOIS: countStage('DEPOIS'),
    QTD_FOTOS_TROCAS: countStage('TROCAS'),
    QTD_FOTOS_CHECKOUT: countStage('CHECKOUT'),
    TOTAL_FOTOS: events.length,
    PASTA_FOTOS_DRIVE_URL: manifest.folderUrl || '',
    STATUS_UPLOAD_FOTOS: 'CONCLUIDO',
    STATUS_ANALISE: aiResults.length ? 'CONCLUIDA' : 'PENDENTE',
    STATUS_REVISAO: 'PENDENTE',
    STATUS_RELATORIO: 'PENDENTE',
    ATUALIZADO_EM: getBrasiliaISO(),
  };
};

const parseObject = (body: string) => {
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : null;
  } catch {
    return null;
  }
};

export const validatePhotoUploadResponse = (body: string, event: MakePhotoEvent) => {
  const parsed = parseObject(body);
  if (
    parsed?.success !== true
    || parsed?.eventType !== 'PHOTO_UPLOADED'
    || parsed?.eventId !== event.EVENT_ID
    || parsed?.photoId !== event.ID_FOTO
    || !String(parsed?.fileId || '').trim()
    || !String(parsed?.fileUrl || '').trim()
  ) {
    throw new Error('Make não confirmou o upload da foto no Google Drive.');
  }

  return {
    eventId: event.EVENT_ID,
    photoId: event.ID_FOTO,
    stage: event.ETAPA,
    industry: event.INDUSTRIA,
    order: event.ORDEM,
    fileName: event.NOME_ARQUIVO,
    fileId: String(parsed.fileId),
    fileUrl: String(parsed.fileUrl),
    folderId: parsed.folderId ? String(parsed.folderId) : undefined,
    folderUrl: parsed.folderUrl ? String(parsed.folderUrl) : undefined,
    syncedAt: getBrasiliaISO(),
  } satisfies DrivePhotoReceipt;
};

export const validateVisitFinalizeResponse = (body: string, event: MakeVisitFinalizeEvent) => {
  const parsed = parseObject(body);
  const validAction = parsed?.rowAction === 'created' || parsed?.rowAction === 'updated';
  if (
    parsed?.success !== true
    || parsed?.eventType !== 'VISIT_FINALIZED'
    || parsed?.eventId !== event.EVENT_ID
    || parsed?.visitId !== event.ID_VISITA
    || !validAction
  ) {
    throw new Error('Make não confirmou a gravação única da visita na planilha.');
  }

  return {
    rowAction: parsed.rowAction as 'created' | 'updated',
    rowId: parsed.rowId ? String(parsed.rowId) : undefined,
  };
};
