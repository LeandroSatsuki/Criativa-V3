import type { Config, Context } from '@netlify/functions';
import { json } from './_shared/json';
import { authenticate } from './_shared/auth';
import { canAccessVisit } from './_shared/visit-access';
import { getVisit, updateVisit } from './_shared/visits';

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

  const existing = await getVisit(visitId);
  if (!existing || !canAccessVisit(existing, auth)) {
    return json({ error: 'Visita não encontrada' }, 404);
  }

  const patch = await request.json().catch(() => ({}));
  const protectedPatch = patch?.payload
    ? { ...patch, payload: { ...patch.payload, user: existing.payload?.user } }
    : { ...patch, user: existing.payload?.user };
  const record = await updateVisit(visitId, protectedPatch);
  return json(record);
};

export const config: Config = {
  path: '/api/visits/:id',
  method: ['PATCH'],
};
