import type { Role, User } from '../../../src/types';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from './env';

type SessionPayload = {
  sub: string;
  name: string;
  role: Role;
  user: string;
  region?: string;
  storeResponsible?: string;
  exp: number;
};

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const getSecret = () => getEnv('APP_SESSION_SECRET');

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = <T>(value: string) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;

const sign = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('base64url');

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const createSessionToken = (user: User) => {
  const secret = getSecret();
  if (!secret) {
    throw new Error('APP_SESSION_SECRET não configurado no backend.');
  }

  const payload: SessionPayload = {
    sub: user.id,
    name: user.name,
    role: user.role,
    user: user.user,
    region: user.region,
    storeResponsible: user.storeResponsible,
    exp: Date.now() + TOKEN_TTL_MS,
  };

  const encoded = encode(payload);
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
};

export const authenticate = (request: Request) => {
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
    return payload;
  } catch {
    return null;
  }
};

export const requireAuth = (request: Request) => {
  const auth = authenticate(request);
  if (!auth) {
    return { error: new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } }) } as const;
  }
  return { auth } as const;
};
