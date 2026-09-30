import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { OAuth2Client } from 'google-auth-library';

const STATE_TTL_MS = 10 * 60 * 1000;

type StatePayload = { nonce: string; exp: number };

export type OAuthStateStore = {
  create(nonce: string, expiresAt: Date): Promise<void>;
  consume(nonce: string, now: Date): Promise<boolean>;
};

export type SecretVersionWriter = {
  addSecretVersion(secretName: string, value: string): Promise<void>;
};

const encode = (value: string) => Buffer.from(value).toString('base64url');

const signature = (payload: string, secret: string) => createHmac('sha256', secret)
  .update(payload)
  .digest('base64url');

export const createOAuthState = async (
  secret: string,
  store: OAuthStateStore,
  now = new Date(),
) => {
  const payload: StatePayload = {
    nonce: randomBytes(24).toString('base64url'),
    exp: now.getTime() + STATE_TTL_MS,
  };
  await store.create(payload.nonce, new Date(payload.exp));
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secret)}`;
};

export const consumeOAuthState = async (
  state: string,
  secret: string,
  store: OAuthStateStore,
  now = new Date(),
) => {
  const [encoded, provided] = state.split('.');
  if (!encoded || !provided) return false;
  const expected = signature(encoded, secret);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StatePayload;
    if (!payload.nonce || !Number.isFinite(payload.exp) || payload.exp < now.getTime()) return false;
    return store.consume(payload.nonce, now);
  } catch {
    return false;
  }
};

export const buildAuthorizationUrl = (client: OAuth2Client, state: string) => client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  state,
  scope: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

export const exchangeAndStoreRefreshToken = async (
  client: OAuth2Client,
  code: string,
  writer: SecretVersionWriter,
  secretName: string,
) => {
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google nao retornou refresh token; repita o consentimento com prompt=consent.');
  }
  await writer.addSecretVersion(secretName, tokens.refresh_token);
};

export const bearerMatches = (authorization: string | undefined, expected: string) => {
  const provided = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
};
