import { createHash } from 'node:crypto';
import {
  formatBrasiliaDate,
  formatBrasiliaTime,
  formatFileDate,
  getBrasiliaISO,
  parseBrasiliaDate,
} from './time.ts';

export const MAKE_CONTRACT_VERSION = '2.1';
export const MAKE_PHOTOS_PER_RUN = 3;
export const MAKE_MAX_PHOTOS_PER_BATCH = 20;

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
  PASTA_INDUSTRIA_NOME: string;
  PASTA_VISITA_NOME: string;
  PASTA_PDV_NOME: string;
  PASTA_SUBPASTA_NOME: '' | 'DEVOLUCOES';
  LAYOUT_PASTAS: 'INDUSTRIA_DATA_PDV_V1';
  NOME_LOJA: string;
  NOME_PROMOTOR: string;
  ROW_WRITE: false;
};

export type MakePhotoBatchItem = Pick<MakePhotoEvent,
  | 'EVENT_ID'
  | 'IDEMPOTENCY_KEY'
  | 'ID_FOTO'
  | 'ETAPA'
  | 'INDUSTRIA'
  | 'ORDEM'
  | 'NOME_ARQUIVO'
  | 'MIME_TYPE'
  | 'TAMANHO_BYTES'
  | 'FOTO_BASE64'
>;

export type MakePhotoBatchEvent = {
  CONTRACT_VERSION: string;
  EVENT_TYPE: 'PHOTO_UPLOAD_BATCH';
  EVENT_ID: string;
  BATCH_ID: string;
  ID_VISITA: string;
  PASTA_INDUSTRIA_NOME: string;
  PASTA_VISITA_NOME: string;
  PASTA_PDV_NOME: string;
  PASTA_SUBPASTA_NOME: '' | 'DEVOLUCOES';
  LAYOUT_PASTAS: 'INDUSTRIA_DATA_PDV_V1';
  NOME_LOJA: string;
  NOME_PROMOTOR: string;
  ROW_WRITE: false;
  TOTAL_FOTOS: number;
  PHOTOS: MakePhotoBatchItem[];
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
  pdvFolderId?: string;
  pdvFolderUrl?: string;
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

const safeFolderName = (value: unknown, fallback: string) => normalizeText(value, fallback)
  .replace(/[\u0000-\u001f]/g, ' ')
  .replace(/[\\/]+/g, ' - ')
  .replace(/\s+/g, ' ')
  .replace(/[. ]+$/g, '')
  .slice(0, 120) || fallback;

const hashPhoto = (base64: string) => createHash('sha256').update(base64).digest('hex');

const calculateDuration = (checkInValue: unknown, checkOutValue: unknown) => {
  if (!checkInValue) return '';
  const checkIn = parseBrasiliaDate(String(checkInValue));
  const checkOut = checkOutValue ? parseBrasiliaDate(String(checkOutValue)) : new Date();
  const diff = Math.max(0, checkOut.getTime() - checkIn.getTime());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const getExecutionEntries = (payload: any) => Object.values(payload.industryExecutions || {})
  .filter(Boolean) as any[];

const getPhotoIndustryNames = (payload: any) => {
  const industries = getExecutionEntries(payload)
    .filter((execution) => Object.values(execution.photos || {}).some(
      (photos) => Array.isArray(photos) && photos.length > 0,
    ))
    .map((execution) => normalizeText(execution.industry, ''))
    .filter(Boolean);

  return Array.from(new Set(industries.length
    ? industries
    : [normalizeText(payload.selectedIndustry || payload.industry, 'GERAL')]));
};

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

  getPhotoIndustryNames(payload).forEach((industry) => {
    addCandidates(candidates, payload.photos?.FACHADA, 'FACHADA', industry);
    addCandidates(candidates, payload.photos?.CHECKOUT, 'CHECKOUT', industry);
  });

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

  // Preserve repeated captures. Retries remain idempotent because each photo ID
  // includes its stage, industry, position and content hash.
  return candidates;
};

export const buildMakePhotoEvents = (payload: any): MakePhotoEvent[] => {
  const visitId = normalizeText(payload.visitId, 'VISIT-SEM-ID');
  const fileDate = formatFileDate(payload.timestamp || payload.checkInTime);
  const storeName = normalizeText(payload.currentStore, 'Loja');
  const promoterName = normalizeText(payload.user?.name, 'Promotor');
  const storeSlug = safeName(storeName, 'LOJA');
  const storeFolderName = safeFolderName(storeName, 'Loja');
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
      PASTA_INDUSTRIA_NOME: candidate.industry,
      PASTA_VISITA_NOME: fileDate,
      PASTA_PDV_NOME: storeFolderName,
      PASTA_SUBPASTA_NOME: candidate.stage === 'TROCAS' ? 'DEVOLUCOES' : '',
      LAYOUT_PASTAS: 'INDUSTRIA_DATA_PDV_V1',
      NOME_LOJA: storeName,
      NOME_PROMOTOR: promoterName,
      ROW_WRITE: false,
    };
  });
};

export const buildMakePhotoBatches = (
  events: MakePhotoEvent[],
  maxPhotos = MAKE_MAX_PHOTOS_PER_BATCH,
): MakePhotoBatchEvent[] => {
  if (!Number.isInteger(maxPhotos) || maxPhotos < 1 || maxPhotos > MAKE_MAX_PHOTOS_PER_BATCH) {
    throw new Error(`O lote deve conter entre 1 e ${MAKE_MAX_PHOTOS_PER_BATCH} fotos.`);
  }

  const groups = new Map<string, MakePhotoEvent[]>();
  events.forEach((event) => {
    const key = [
      event.ID_VISITA,
      event.PASTA_INDUSTRIA_NOME,
      event.PASTA_VISITA_NOME,
      event.PASTA_PDV_NOME,
      event.PASTA_SUBPASTA_NOME,
    ].join('\u001f');
    const group = groups.get(key) || [];
    group.push(event);
    groups.set(key, group);
  });

  return Array.from(groups.values()).flatMap((group) => {
    const batches: MakePhotoBatchEvent[] = [];
    for (let start = 0; start < group.length; start += maxPhotos) {
      const chunk = group.slice(start, start + maxPhotos);
      const first = chunk[0];
      const batchHash = createHash('sha256')
        .update(chunk.map((event) => event.ID_FOTO).join('|'))
        .digest('hex')
        .slice(0, 24);
      const batchId = `${first.ID_VISITA}:BATCH:${batchHash}`;
      batches.push({
        CONTRACT_VERSION: MAKE_CONTRACT_VERSION,
        EVENT_TYPE: 'PHOTO_UPLOAD_BATCH',
        EVENT_ID: batchId,
        BATCH_ID: batchId,
        ID_VISITA: first.ID_VISITA,
        PASTA_INDUSTRIA_NOME: first.PASTA_INDUSTRIA_NOME,
        PASTA_VISITA_NOME: first.PASTA_VISITA_NOME,
        PASTA_PDV_NOME: first.PASTA_PDV_NOME,
        PASTA_SUBPASTA_NOME: first.PASTA_SUBPASTA_NOME,
        LAYOUT_PASTAS: first.LAYOUT_PASTAS,
        NOME_LOJA: first.NOME_LOJA,
        NOME_PROMOTOR: first.NOME_PROMOTOR,
        ROW_WRITE: false,
        TOTAL_FOTOS: chunk.length,
        PHOTOS: chunk.map((event) => ({
          EVENT_ID: event.EVENT_ID,
          IDEMPOTENCY_KEY: event.IDEMPOTENCY_KEY,
          ID_FOTO: event.ID_FOTO,
          ETAPA: event.ETAPA,
          INDUSTRIA: event.INDUSTRIA,
          ORDEM: event.ORDEM,
          NOME_ARQUIVO: event.NOME_ARQUIVO,
          MIME_TYPE: event.MIME_TYPE,
          TAMANHO_BYTES: event.TAMANHO_BYTES,
          FOTO_BASE64: event.FOTO_BASE64,
        })),
      });
    }
    return batches;
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
  const folderLinks = Array.from(new Map(
    Object.values(manifest.photos)
      .map((photo) => ({
        ...photo,
        visitFolderUrl: photo.pdvFolderUrl || photo.folderUrl,
      }))
      .filter((photo) => photo.visitFolderUrl)
      .map((photo) => [photo.industry, `${photo.industry}: ${photo.visitFolderUrl}`]),
  ).values()).join(' | ');
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
    PASTA_FOTOS_DRIVE_URL: folderLinks || manifest.folderUrl || '',
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
    pdvFolderId: parsed.pdvFolderId ? String(parsed.pdvFolderId) : undefined,
    pdvFolderUrl: parsed.pdvFolderUrl ? String(parsed.pdvFolderUrl) : undefined,
    syncedAt: getBrasiliaISO(),
  } satisfies DrivePhotoReceipt;
};

export const validatePhotoBatchUploadResponse = (body: string, batch: MakePhotoBatchEvent) => {
  const parsed = parseObject(body);
  const receipts = Array.isArray(parsed?.receipts) ? parsed.receipts : [];
  const expectedById = new Map(batch.PHOTOS.map((photo) => [photo.ID_FOTO, photo]));
  const receivedIds = receipts.map((receipt: any) => String(receipt?.photoId || ''));
  const complete = receipts.length === batch.PHOTOS.length
    && new Set(receivedIds).size === receipts.length
    && receivedIds.every((photoId: string) => expectedById.has(photoId));

  if (
    parsed?.success !== true
    || parsed?.eventType !== 'PHOTO_BATCH_UPLOADED'
    || parsed?.eventId !== batch.EVENT_ID
    || parsed?.batchId !== batch.BATCH_ID
    || !complete
  ) {
    throw new Error('Make não confirmou todas as fotos do lote no Google Drive.');
  }

  return receipts.map((receipt: any) => {
    const photo = expectedById.get(String(receipt.photoId))!;
    if (!String(receipt?.fileId || '').trim() || !String(receipt?.fileUrl || '').trim()) {
      throw new Error('Make retornou um comprovante incompleto no lote de fotos.');
    }
    return {
      eventId: photo.EVENT_ID,
      photoId: photo.ID_FOTO,
      stage: photo.ETAPA,
      industry: photo.INDUSTRIA,
      order: photo.ORDEM,
      fileName: photo.NOME_ARQUIVO,
      fileId: String(receipt.fileId),
      fileUrl: String(receipt.fileUrl),
      folderId: receipt.folderId ? String(receipt.folderId) : undefined,
      folderUrl: receipt.folderUrl ? String(receipt.folderUrl) : undefined,
      pdvFolderId: receipt.pdvFolderId ? String(receipt.pdvFolderId) : undefined,
      pdvFolderUrl: receipt.pdvFolderUrl ? String(receipt.pdvFolderUrl) : undefined,
      syncedAt: getBrasiliaISO(),
    } satisfies DrivePhotoReceipt;
  });
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
