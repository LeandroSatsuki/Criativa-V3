import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { listVisits } from './_shared/visits';
import { buildSupervisorPromoterDetail } from './_shared/supervisor';
import { getSupervisorAccessError } from './_shared/supervisor-access';

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticate(request);
  const accessError = getSupervisorAccessError(auth);
  if (accessError) {
    return json({ error: accessError.message }, accessError.status);
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
