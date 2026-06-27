import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { listVisits } from './_shared/visits';
import { buildSupervisorPromoterDetail } from './_shared/supervisor';

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authenticate(request);
  if (!auth || auth.role !== 'SUPERVISOR') {
    return json({ error: 'Acesso restrito ao supervisor' }, 403);
  }

  const promoterId = context.params.id as string | undefined;
  if (!promoterId) {
    return json({ error: 'ID do promotor é obrigatório' }, 400);
  }

  const visits = await listVisits();
  const promoterVisits = visits.filter((visit) => String(visit.payload?.user?.id || '') === promoterId);

  return json(buildSupervisorPromoterDetail(promoterVisits));
};

export const config: Config = {
  path: '/api/supervisor/promoters/:id',
};
