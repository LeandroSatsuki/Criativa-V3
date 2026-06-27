import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { createSessionToken } from './_shared/auth';
import { findUserByCredentials } from './_shared/data';

export default async (request: Request, _context: Context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = await request.json().catch(() => null) as { user?: string; pass?: string } | null;
  const user = body?.user?.trim() || '';
  const pass = body?.pass?.trim() || '';

  if (!user || !pass) {
    return json({ error: 'Usuário e senha são obrigatórios' }, 400);
  }

  const found = await findUserByCredentials(user, pass);
  if (!found) {
    return json({ error: 'Credenciais inválidas ou usuário não encontrado.' }, 401);
  }

  try {
    const token = createSessionToken(found);
    return json({
      user: found,
      token,
    });
  } catch (error: any) {
    return json({ error: error.message || 'Falha ao gerar sessão' }, 500);
  }
};

export const config: Config = {
  path: '/api/auth/login',
};
