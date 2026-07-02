import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { updateVisit } from './_shared/visits';

export default async (request: Request, context: Context) => {
  if (request.method !== 'PATCH') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const visitId = context.params.id as string | undefined;
  if (!visitId) {
    return json({ error: 'ID da visita é obrigatório' }, 400);
  }

  const patch = await request.json().catch(() => ({}));
  const record = await updateVisit(visitId, patch);
  return json(record);
};

export const config: Config = {
  path: '/api/visits/:id',
  method: ['PATCH'],
};
