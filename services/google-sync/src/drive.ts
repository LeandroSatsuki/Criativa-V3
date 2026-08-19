import { Readable } from 'node:stream';
import type { drive_v3 } from 'googleapis';
import type { PhotoReceipt, StagedPhoto } from './contracts.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const cleanFolder = (value: string) => value.replace(/[\\/\u0000-\u001f]+/g, ' - ').trim().slice(0, 120);
const q = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
const fileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;

export class DriveWriter {
  constructor(private readonly drive: drive_v3.Drive, private readonly rootFolderId: string) {}

  private async findFolder(name: string, parentId: string) {
    const response = await this.drive.files.list({
      q: `'${q(parentId)}' in parents and name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: 'files(id,name)',
      pageSize: 2,
    });
    return response.data.files?.[0]?.id || undefined;
  }

  private async ensureFolder(rawName: string, parentId: string) {
    const name = cleanFolder(rawName);
    if (!name) throw new Error('Nome de pasta vazio.');
    const existing = await this.findFolder(name, parentId);
    if (existing) return existing;
    const created = await this.drive.files.create({
      requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: 'id',
    });
    if (!created.data.id) throw new Error('Drive nao retornou o ID da pasta criada.');
    return created.data.id;
  }

  private async findPhoto(photoId: string, parentId: string) {
    const response = await this.drive.files.list({
      q: `'${q(parentId)}' in parents and appProperties has { key='criativaPhotoId' and value='${q(photoId)}' } and trashed = false`,
      fields: 'files(id,name)',
      pageSize: 2,
    });
    return response.data.files?.[0]?.id || undefined;
  }

  async upload(photo: StagedPhoto, content: Buffer, now = new Date()): Promise<PhotoReceipt> {
    const industryId = await this.ensureFolder(photo.industryFolderName, this.rootFolderId);
    const dateId = await this.ensureFolder(photo.visitFolderName, industryId);
    const pdvId = await this.ensureFolder(photo.pdvFolderName, dateId);
    const targetId = photo.subfolderName ? await this.ensureFolder(photo.subfolderName, pdvId) : pdvId;
    let id = await this.findPhoto(photo.photoId, targetId);
    if (!id) {
      const created = await this.drive.files.create({
        requestBody: {
          name: photo.fileName,
          parents: [targetId],
          appProperties: {
            criativaPhotoId: photo.photoId,
            criativaVisitId: photo.visitId,
            criativaEventId: photo.eventId,
          },
        },
        media: { mimeType: photo.mimeType, body: Readable.from(content) },
        fields: 'id',
      });
      id = created.data.id || undefined;
    }
    if (!id) throw new Error('Drive nao retornou o ID do arquivo.');

    return {
      eventId: photo.eventId,
      photoId: photo.photoId,
      stage: photo.stage,
      industry: photo.industry,
      order: photo.order,
      fileName: photo.fileName,
      fileId: id,
      fileUrl: fileUrl(id),
      folderId: targetId,
      folderUrl: folderUrl(targetId),
      pdvFolderId: pdvId,
      pdvFolderUrl: folderUrl(pdvId),
      syncedAt: now.toISOString(),
    };
  }
}
