import { Firestore, Timestamp } from '@google-cloud/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { google } from 'googleapis';
import type { GoogleAuth } from 'google-auth-library';
import type { OAuthStateStore, SecretVersionWriter } from './oauth.js';

export class FirestoreOAuthStateStore implements OAuthStateStore {
  constructor(private readonly firestore: Firestore) {}

  async create(nonce: string, expiresAt: Date) {
    await this.firestore.collection('oauth_states').doc(nonce).create({
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
    });
  }

  async consume(nonce: string, now: Date) {
    const reference = this.firestore.collection('oauth_states').doc(nonce);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;
      const data = snapshot.data();
      const expiresAt = data?.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : new Date(0);
      if (data?.used || expiresAt.getTime() < now.getTime()) return false;
      transaction.update(reference, { used: true, usedAt: Timestamp.fromDate(now) });
      return true;
    });
  }
}

export class GoogleSecretWriter implements SecretVersionWriter {
  constructor(private readonly client: SecretManagerServiceClient) {}

  async addSecretVersion(secretName: string, value: string) {
    await this.client.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(value, 'utf8') },
    });
  }
}

export class GcsPhotoStore {
  constructor(private readonly auth: GoogleAuth, private readonly bucketName: string) {}

  private objectUrl(objectName: string, media = false) {
    const suffix = media ? '?alt=media' : '';
    return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(this.bucketName)}/o/${encodeURIComponent(objectName)}${suffix}`;
  }

  async write(objectName: string, content: Buffer, mimeType = 'image/jpeg') {
    if (!objectName.startsWith('staging/')) throw new Error('Objeto fora da area temporaria.');
    const token = await this.auth.getAccessToken();
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucketName)}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(objectName)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': mimeType,
      },
      body: content,
    });
    if (!response.ok && response.status !== 412) {
      throw new Error(`Falha ao gravar objeto temporario: HTTP ${response.status}`);
    }
  }

  async read(objectName: string) {
    if (!objectName.startsWith('staging/')) throw new Error('Objeto fora da area temporaria.');
    const token = await this.auth.getAccessToken();
    const response = await fetch(this.objectUrl(objectName, true), {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Falha ao ler objeto temporario: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async remove(objectName: string) {
    if (!objectName.startsWith('staging/')) throw new Error('Objeto fora da area temporaria.');
    const token = await this.auth.getAccessToken();
    const response = await fetch(this.objectUrl(objectName), {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Falha ao remover objeto temporario: HTTP ${response.status}`);
    }
  }
}

export const createCloudAuth = () => new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

export const createOAuthClient = (clientId: string, clientSecret: string, redirectUri: string) =>
  new google.auth.OAuth2(clientId, clientSecret, redirectUri);

export const createAuthorizedGoogleClients = (
  clientId: string,
  clientSecret: string,
  refreshToken: string,
) => {
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return {
    drive: google.drive({ version: 'v3', auth }),
    sheets: google.sheets({ version: 'v4', auth }),
  };
};
