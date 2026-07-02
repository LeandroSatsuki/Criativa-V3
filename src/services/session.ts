import type { User } from '../types';

export type SessionData = {
  token: string;
  user: User;
  issuedAt: string;
};

const SESSION_KEY = 'criativa_session';
const LAST_LOGIN_USER_KEY = 'criativa_last_login_user';

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
  localStorage.setItem(LAST_LOGIN_USER_KEY, session.user.user);
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getLastLoginUser = () => localStorage.getItem(LAST_LOGIN_USER_KEY) || '';
