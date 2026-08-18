import type { Role, User } from '../../../src/types';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getEnv } from './env';
import { getJsonStore, isExpiredNetlifyBlobTokenError } from './storage';
import { renewSessionExpiration, SESSION_TTL_MS } from './session-policy';
export { SESSION_TTL_MS } from './session-policy';

export type SessionPayload = {
  sub: string;
  name: string;
  role: Role;
  user: string;
  region?: string;
  storeResponsible?: string;
  sid: string;
  exp: number;
};

export type AuthenticationRejectionReason =
  | 'missing_token'
  | 'missing_session_secret'
  | 'malformed_token'
  | 'invalid_signature'
  | 'token_decode_failed'
  | 'expired_token'
  | 'missing_session_id'
  | 'session_not_found'
  | 'session_replaced';

export type AuthenticationResult =
  | { auth: SessionPayload; reason: null }
  | { auth: null; reason: AuthenticationRejectionReason };

const sessionStore = getJsonStore('criativa-sessions');

const getSecret = () => getEnv('APP_SESSION_SECRET');
const sessionKeyFor = (userId: string) => `users/${userId.toLowerCase().trim()}`;
const rejectAuthentication = (reason: AuthenticationRejectionReason): AuthenticationResult => {
  console.warn(JSON.stringify({ event: 'auth_rejected', reason }));
  return { auth: null, reason };
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = <T>(value: string) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;

const sign = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('base64url');

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const encodeSessionToken = (payload: SessionPayload, secret: string) => {
  const encoded = encode(payload);
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
};

export const createSessionToken = async (user: User) => {
  const secret = getSecret();
  if (!secret) {
    throw new Error('APP_SESSION_SECRET não configurado no backend.');
  }

  const sessionId = randomUUID();
  const payload: SessionPayload = {
    sub: user.id,
    name: user.name,
    role: user.role,
    user: user.user,
    region: user.region,
    storeResponsible: user.storeResponsible,
    sid: sessionId,
    exp: Date.now() + SESSION_TTL_MS,
  };

  await sessionStore.set(sessionKeyFor(user.id), {
    sessionId,
    user: user.user,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(payload.exp).toISOString(),
  });

  return encodeSessionToken(payload, secret);
};

export const renewSessionToken = async (payload: SessionPayload) => {
  const secret = getSecret();
  if (!secret) {
    throw new Error('APP_SESSION_SECRET não configurado no backend.');
  }

  const renewed = renewSessionExpiration(payload);
  await sessionStore.set(sessionKeyFor(payload.sub), {
    sessionId: payload.sid,
    user: payload.user,
    refreshedAt: new Date().toISOString(),
    expiresAt: new Date(renewed.exp).toISOString(),
  });

  return {
    token: encodeSessionToken(renewed, secret),
    expiresAt: new Date(renewed.exp).toISOString(),
  };
};

export const authenticateDetailed = async (request: Request): Promise<AuthenticationResult> => {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return rejectAuthentication('missing_token');

  const secret = getSecret();
  if (!secret) return rejectAuthentication('missing_session_secret');

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return rejectAuthentication('malformed_token');

  const expected = sign(encoded, secret);
  if (!safeEqual(signature, expected)) return rejectAuthentication('invalid_signature');

  let payload: SessionPayload;
  try {
    payload = decode<SessionPayload>(encoded);
  } catch {
    return rejectAuthentication('token_decode_failed');
  }

  if (payload.exp < Date.now()) return rejectAuthentication('expired_token');
  if (!payload.sid) return rejectAuthentication('missing_session_id');

  try {
    const active = await sessionStore.get<{ sessionId?: string }>(sessionKeyFor(payload.sub));
    if (!active?.sessionId) return rejectAuthentication('session_not_found');
    if (active.sessionId !== payload.sid) return rejectAuthentication('session_replaced');
  } catch (error) {
    console.error(JSON.stringify({
      event: 'auth_storage_unavailable',
      reason: isExpiredNetlifyBlobTokenError(error) ? 'blob_token_expired' : 'storage_error',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
    throw error;
  }

  return { auth: payload, reason: null };
};

export const authenticate = async (request: Request) => {
  const result = await authenticateDetailed(request);
  return result.auth;
};

export const requireAuth = async (request: Request) => {
  const auth = await authenticate(request);
  if (!auth) {
    return { error: new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } }) } as const;
  }
  return { auth } as const;
};
