import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { listVisits } from './_shared/visits';
import { buildSupervisorPromoterDetail } from './_shared/supervisor';
import { getSupervisorAccessError } from './_shared/supervisor-access';
import { getAppData } from './_shared/data';

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

  const [visits, data] = await Promise.all([listVisits(), getAppData()]);
  const promoter = data.promoters.find((item) => item.id === promoterId);
  const identities = new Set(
    [promoterId, promoter?.user]
      .map((value) => String(value || '').toLowerCase().trim())
      .filter(Boolean),
  );
  const promoterVisits = visits.filter((visit) => (
    identities.has(String(visit.payload?.user?.id || '').toLowerCase().trim()) ||
    identities.has(String(visit.payload?.user?.user || '').toLowerCase().trim())
  ));

  return json(buildSupervisorPromoterDetail(promoterVisits, promoter
    ? { ...promoter, registered: true }
    : { id: promoterId, registered: false }));
};

export const config: Config = {
  path: '/api/supervisor/promoters/:id',
};
