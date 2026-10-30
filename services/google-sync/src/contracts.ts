export type PhotoStage = 'FACHADA' | 'ANTES' | 'ESTOQUE' | 'DEPOIS' | 'TROCAS' | 'CHECKOUT';

export type StagedPhoto = {
  eventId: string;
  idempotencyKey: string;
  visitId: string;
  photoId: string;
  stage: PhotoStage;
  industry: string;
  order: number;
  fileName: string;
  mimeType: 'image/jpeg';
  objectName: string;
  industryFolderName: string;
  visitFolderName: string;
  pdvFolderName: string;
  subfolderName: '' | 'DEVOLUCOES';
};

export type PhotoReceipt = {
  eventId: string;
  photoId: string;
  stage: PhotoStage;
  industry: string;
  order: number;
  fileName: string;
  fileId: string;
  fileUrl: string;
  folderId: string;
  folderUrl: string;
  pdvFolderId: string;
  pdvFolderUrl: string;
  syncedAt: string;
};

export type PhotoBatchJob = {
  eventType: 'PHOTO_UPLOAD_BATCH';
  eventId: string;
  batchId: string;
  photos: StagedPhoto[];
};

export type IngressPhoto = Omit<StagedPhoto, 'objectName'> & {
  base64: string;
};

export type PhotoBatchIngress = {
  eventType: 'PHOTO_UPLOAD_BATCH';
  eventId: string;
  batchId: string;
  photos: IngressPhoto[];
};

export type VisitFinalizeJob = {
  eventType: 'VISIT_FINALIZE';
  eventId: string;
  idempotencyKey: string;
  visitId: string;
  row: Record<string, string | number> & { ID_VISITA: string };
};
