import type { Config, Context } from '@netlify/functions';
import { authenticateDetailed, renewSessionToken } from './_shared/auth';
import { json } from './_shared/json';
import { isExpiredNetlifyBlobTokenError } from './_shared/storage';

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authentication = await authenticateDetailed(request);
    if (!authentication.auth) {
      const replaced = authentication.reason === 'session_replaced';
      return json({
        error: replaced
          ? 'Este acesso foi encerrado porque a conta entrou em outro aparelho.'
          : 'Sua sessão expirou. Entre novamente para continuar.',
        code: replaced ? 'SESSION_REPLACED' : 'SESSION_INVALID',
      }, 401);
    }

    const auth = authentication.auth;
    const renewed = await renewSessionToken(auth);
    return json({
      ...renewed,
      user: {
        id: auth.sub,
        name: auth.name,
        role: auth.role,
        region: auth.region,
        storeResponsible: auth.storeResponsible,
        user: auth.user,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'auth_session_refresh_unavailable',
      reason: isExpiredNetlifyBlobTokenError(error) ? 'blob_token_expired' : 'dependency_error',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      requestId: context.requestId,
    }));
    return json({
      error: 'Não foi possível renovar a sessão agora. Tente novamente.',
      code: 'SESSION_REFRESH_UNAVAILABLE',
    }, 503);
  }
};

export const config: Config = {
  path: '/api/auth/session',
};
