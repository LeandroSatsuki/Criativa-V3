import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { getVisit } from './_shared/visits';
import { syncVisitRecord } from './_shared/sync';

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const visitId = context.params.id as string | undefined;
  if (!visitId) {
    return json({ error: 'ID da visita é obrigatório' }, 400);
  }

  const visit = await getVisit(visitId);
  if (!visit) {
    return json({ error: 'Visita não encontrada' }, 404);
  }

  const result = await syncVisitRecord({
    ...visit,
    syncStatus: 'reenviar',
  });

  const status = result.syncStatus === 'enviado' ? 200 : result.syncStatus === 'erro' ? 502 : 202;
  return json(result, status);
};

export const config: Config = {
  path: '/api/sync/:id/retry',
  method: ['POST'],
};
