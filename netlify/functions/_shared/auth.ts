import type { Role, User } from '../../../src/types';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getEnv } from './env';
import { getJsonStore } from './storage';

type SessionPayload = {
  sub: string;
  name: string;
  role: Role;
  user: string;
  region?: string;
  storeResponsible?: string;
  sid: string;
  exp: number;
};

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const sessionStore = getJsonStore('criativa-sessions');

const getSecret = () => getEnv('APP_SESSION_SECRET');
const sessionKeyFor = (userId: string) => `users/${userId.toLowerCase().trim()}`;

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = <T>(value: string) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;

const sign = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('base64url');

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
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
    exp: Date.now() + TOKEN_TTL_MS,
  };

  await sessionStore.set(sessionKeyFor(user.id), {
    sessionId,
    user: user.user,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(payload.exp).toISOString(),
  });

  const encoded = encode(payload);
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
};

export const authenticate = async (request: Request) => {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  const secret = getSecret();
  if (!secret) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = decode<SessionPayload>(encoded);
    if (payload.exp < Date.now()) return null;
    if (!payload.sid) return null;

    const active = await sessionStore.get<{ sessionId?: string }>(sessionKeyFor(payload.sub));
    if (active?.sessionId !== payload.sid) return null;

    return payload;
  } catch {
    return null;
  }
};

export const requireAuth = async (request: Request) => {
  const auth = await authenticate(request);
  if (!auth) {
    return { error: new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } }) } as const;
  }
  return { auth } as const;
};
