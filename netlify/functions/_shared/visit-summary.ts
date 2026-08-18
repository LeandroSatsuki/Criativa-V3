export type VisitSyncStatus = 'pendente' | 'enviando' | 'enviado' | 'erro' | 'reenviar';

export type VisitSummary = {
  visitId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: VisitSyncStatus;
  syncError?: string | null;
  photoCount: number;
  taskCount: number;
  payload: {
    user?: {
      id?: string;
      user?: string;
      name?: string;
      region?: string;
    };
    currentStore?: string;
    currentStoreId?: string;
    storeId?: string;
    checkInTime?: string;
    checkOutTime?: string;
  };
};

type SummarizableVisit = {
  visitId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: VisitSyncStatus;
  syncError?: string | null;
  payload?: any;
};

export const countUniqueVisitPhotos = (payload: any) => {
  const uniquePhotos = new Set<string>();
  const addPhotos = (photos: unknown) => {
    if (!Array.isArray(photos)) return;
    photos.forEach((photo) => {
      if (typeof photo === 'string' && photo.trim()) uniquePhotos.add(photo);
    });
  };

  Object.values(payload?.photos || {}).forEach(addPhotos);
  Object.values(payload?.industryExecutions || {}).forEach((execution: any) => {
    Object.values(execution?.photos || {}).forEach(addPhotos);
  });
  Object.values(payload?.returnsPhotosByIndustry || {}).forEach(addPhotos);
  return uniquePhotos.size;
};

export const buildVisitSummary = (visit: SummarizableVisit): VisitSummary => ({
  visitId: visit.visitId,
  createdAt: visit.createdAt,
  updatedAt: visit.updatedAt,
  syncStatus: visit.syncStatus,
  syncError: visit.syncError || null,
  photoCount: countUniqueVisitPhotos(visit.payload),
  taskCount: Object.keys(visit.payload?.tasks || {}).length,
  payload: {
    user: visit.payload?.user ? {
      id: String(visit.payload.user.id || ''),
      user: String(visit.payload.user.user || ''),
      name: String(visit.payload.user.name || ''),
      region: String(visit.payload.user.region || ''),
    } : undefined,
    currentStore: String(visit.payload?.currentStore || ''),
    currentStoreId: String(visit.payload?.currentStoreId || visit.payload?.storeId || ''),
    storeId: String(visit.payload?.storeId || visit.payload?.currentStoreId || ''),
    checkInTime: visit.payload?.checkInTime || undefined,
    checkOutTime: visit.payload?.checkOutTime || undefined,
  },
});

export const completeVisitSummaryIndex = async (
  visitKeys: string[],
  existingSummaries: VisitSummary[],
  loadVisit: (key: string) => Promise<SummarizableVisit | null>,
  saveSummary: (summary: VisitSummary) => Promise<void>,
  batchSize = 4,
) => {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Tamanho de lote invalido para indexacao de visitas.');
  }

  const summariesById = new Map(existingSummaries.map((summary) => [summary.visitId, summary]));
  const missingKeys = visitKeys.filter((key) => {
    const visitId = key.slice('visits/'.length);
    return !summariesById.has(visitId);
  });

  for (let index = 0; index < missingKeys.length; index += batchSize) {
    const batch = missingKeys.slice(index, index + batchSize);
    const migrated = await Promise.all(batch.map(async (key) => {
      const record = await loadVisit(key);
      if (!record) throw new Error(`Visita ausente durante indexacao: ${key}`);
      const summary = buildVisitSummary(record);
      await saveSummary(summary);
      return summary;
    }));
    migrated.forEach((summary) => summariesById.set(summary.visitId, summary));
  }

  if (summariesById.size !== visitKeys.length) {
    throw new Error('Indice de visitas incompleto; painel nao foi calculado.');
  }

  return visitKeys.map((key) => summariesById.get(key.slice('visits/'.length)) as VisitSummary);
};
