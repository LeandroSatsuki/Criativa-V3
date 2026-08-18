import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { createSessionToken } from './_shared/auth';
import { findUserByCredentials, InactiveUserError } from './_shared/data';
import { isExpiredNetlifyBlobTokenError } from './_shared/storage';

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = await request.json().catch(() => null) as { user?: string; pass?: string } | null;
  const user = body?.user?.trim() || '';
  const pass = body?.pass?.trim() || '';

  if (!user || !pass) {
    return json({ error: 'Usuário e senha são obrigatórios' }, 400);
  }

  try {
    const found = await findUserByCredentials(user, pass);
    if (!found) {
      return json({ error: 'Credenciais inválidas ou usuário não encontrado.' }, 401);
    }

    const token = await createSessionToken(found);
    return json({
      user: found,
      token,
    });
  } catch (error) {
    if (error instanceof InactiveUserError) {
      return json({ error: error.message, code: 'ACCOUNT_INACTIVE' }, 403);
    }
    console.error(JSON.stringify({
      event: 'auth_login_unavailable',
      reason: isExpiredNetlifyBlobTokenError(error) ? 'blob_token_expired' : 'dependency_error',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      requestId: context.requestId,
    }));
    return json({ error: 'Serviço de autenticação temporariamente indisponível. Tente novamente.' }, 503);
  }
};

export const config: Config = {
  path: '/api/auth/login',
};
