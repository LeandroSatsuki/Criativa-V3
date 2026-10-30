import assert from 'node:assert/strict';
import test from 'node:test';
import type { drive_v3 } from 'googleapis';
import { DriveWriter } from '../src/drive.ts';
import type { StagedPhoto } from '../src/contracts.ts';

const photo: StagedPhoto = {
  eventId: 'visit-1:PHOTO:photo-1',
  idempotencyKey: 'photo-1',
  visitId: 'visit-1',
  photoId: 'photo-1',
  stage: 'TROCAS',
  industry: 'VENEZA',
  order: 1,
  fileName: 'LOJA_TROCAS_01.jpg',
  mimeType: 'image/jpeg',
  objectName: 'staging/hash/photo.jpg',
  industryFolderName: 'VENEZA',
  visitFolderName: '19-08-2026',
  pdvFolderName: 'Loja Centro',
  subfolderName: 'DEVOLUCOES',
};

test('cria arvore completa e reutiliza pasta e arquivo no retry', async () => {
  const folders = new Map<string, string>();
  const files = new Map<string, string>();
  let folderCreates = 0;
  let fileCreates = 0;
  const drive = {
    files: {
      list: async ({ q }: { q: string }) => {
        const parent = /'([^']+)' in parents/.exec(q)?.[1] || '';
        const name = /name = '([^']+)'/.exec(q)?.[1];
        const photoId = /criativaPhotoId' and value='([^']+)'/.exec(q)?.[1];
        const id = name ? folders.get(`${parent}/${name}`) : files.get(`${parent}/${photoId}`);
        return { data: { files: id ? [{ id }] : [] } };
      },
      create: async ({ requestBody }: { requestBody: Record<string, any> }) => {
        const parent = requestBody.parents[0];
        if (requestBody.mimeType === 'application/vnd.google-apps.folder') {
          const id = `folder-${++folderCreates}`;
          folders.set(`${parent}/${requestBody.name}`, id);
          return { data: { id } };
        }
        const id = `file-${++fileCreates}`;
        files.set(`${parent}/${requestBody.appProperties.criativaPhotoId}`, id);
        return { data: { id } };
      },
    },
  } as unknown as drive_v3.Drive;
  const writer = new DriveWriter(drive, 'root');

  const first = await writer.upload(photo, Buffer.from('foto'));
  const retry = await writer.upload(photo, Buffer.from('foto'));

  assert.equal(folderCreates, 4);
  assert.equal(fileCreates, 1);
  assert.equal(first.fileId, retry.fileId);
  assert.equal(first.pdvFolderUrl, 'https://drive.google.com/drive/folders/folder-3');
  assert.equal(first.folderUrl, 'https://drive.google.com/drive/folders/folder-4');
});
