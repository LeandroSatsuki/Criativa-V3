const fs = require('node:fs');
const path = require('node:path');

const webhookUrl = process.env.MAKE_HOMOLOG_WEBHOOK_URL || '';
const count = Number.parseInt(process.argv[2] || '10', 10);
const imagePath = process.argv[3];

if (!webhookUrl.startsWith('https://hook.us2.make.com/')) {
  throw new Error('Webhook de homologacao ausente ou invalido.');
}
if (!Number.isInteger(count) || count < 1 || count > 20) {
  throw new Error('A quantidade deve estar entre 1 e 20.');
}
if (!imagePath) {
  throw new Error('Informe o caminho de uma imagem de teste.');
}

const imageBuffer = fs.readFileSync(path.resolve(imagePath));
const imageBase64 = imageBuffer.toString('base64');
const probeId = `direct-parent-v4-${count}-${Date.now()}`;
const batchId = `homolog:${probeId}`;
const photos = Array.from({ length: count }, (_, index) => {
  const order = index + 1;
  return {
    EVENT_ID: `${batchId}:photo:${order}`,
    IDEMPOTENCY_KEY: `${batchId}:photo:${order}`,
    ID_FOTO: `${probeId}-photo-${order}`,
    ETAPA: order % 2 === 0 ? 'DEPOIS' : 'ANTES',
    INDUSTRIA: 'HOMOLOGACAO_CREDITO_V4',
    ORDEM: order,
    NOME_ARQUIVO: `HOMOLOG_DIRECT_PARENT_V4_${count}_${order}.jpg`,
    MIME_TYPE: 'image/jpeg',
    TAMANHO_BYTES: imageBuffer.length,
    FOTO_BASE64: imageBase64,
  };
});

const payload = {
  CONTRACT_VERSION: '2.1',
  EVENT_TYPE: 'PHOTO_UPLOAD_BATCH',
  EVENT_ID: batchId,
  BATCH_ID: batchId,
  ID_VISITA: `visit-${probeId}`,
  PASTA_INDUSTRIA_NOME: 'HOMOLOGACAO_CREDITO_V4',
  PASTA_VISITA_NOME: '18-08-2026',
  PASTA_PDV_NOME: `PDV TESTE CREDITO V4 LOTE ${count}`,
  PASTA_SUBPASTA_NOME: '',
  LAYOUT_PASTAS: 'INDUSTRIA_DATA_PDV_V1',
  NOME_LOJA: `PDV TESTE CREDITO V4 LOTE ${count}`,
  NOME_PROMOTOR: 'HOMOLOGACAO CODEX',
  ROW_WRITE: false,
  TOTAL_FOTOS: count,
  PHOTOS: photos,
};

const run = async () => {
const startedAt = Date.now();
const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(90_000),
});
const responseBody = await response.json().catch(() => null);
const receipts = Array.isArray(responseBody?.receipts) ? responseBody.receipts : [];
const receiptPhotoIds = new Set(receipts.map((receipt) => receipt.photoId));
const folderIds = new Set(receipts.map((receipt) => receipt.folderId));
const pdvFolderIds = new Set(receipts.map((receipt) => receipt.pdvFolderId));

console.log(JSON.stringify({
  httpStatus: response.status,
  elapsedMs: Date.now() - startedAt,
  success: responseBody?.success === true,
  eventType: responseBody?.eventType,
  requestedPhotos: count,
  receiptCount: receipts.length,
  everyPhotoConfirmed: photos.every((photo) => receiptPhotoIds.has(photo.ID_FOTO)),
  uniqueFileIds: new Set(receipts.map((receipt) => receipt.fileId)).size,
  oneFolder: folderIds.size === 1,
  folderMatchesPdv: folderIds.size === 1
    && pdvFolderIds.size === 1
    && [...folderIds][0] === [...pdvFolderIds][0],
  imageBytesEach: imageBuffer.length,
  payloadBytes: Buffer.byteLength(JSON.stringify(payload)),
}));

if (!response.ok || responseBody?.success !== true || receipts.length !== count) {
  process.exitCode = 1;
}
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Falha no teste de lote.');
  process.exitCode = 1;
});
