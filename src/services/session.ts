import type { User } from '../types';

export type SessionData = {
  token: string;
  user: User;
  issuedAt: string;
};

const SESSION_KEY = 'criativa_session';

export const getSession = (): SessionData | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
};

export const getSessionToken = () => getSession()?.token || null;

export const setSession = (session: SessionData) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};
