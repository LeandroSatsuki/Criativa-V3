import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { listVisits } from './_shared/visits';

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });

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

  return json({
    metrics: {
      efficiency: promoterVisits.length
        ? `${Math.min(100, Math.round((promoterVisits.filter((visit) => visit.syncStatus === 'enviado').length / promoterVisits.length) * 100))}%`
        : '0%',
      workingTime: promoterVisits.length
        ? `${Math.max(1, promoterVisits.length)} visitas`
        : '0 visitas',
    },
    route: promoterVisits.slice(-10).reverse().map((visit, index) => ({
      id: `${visit.visitId}-${index}`,
      name: visit.payload?.currentStore || 'Loja sem nome',
      time: formatTime(visit.updatedAt || visit.createdAt),
      status: visit.syncStatus === 'enviado'
        ? 'CONCLUÍDO'
        : visit.syncStatus === 'enviando'
          ? 'EM ANDAMENTO'
          : visit.syncStatus === 'erro'
            ? 'PENDENTE'
            : 'PENDENTE',
      tasks: Object.keys(visit.payload?.tasks || {}).length,
      photos: Object.values(visit.payload?.photos || {}).flat().length,
    })),
  });
};

export const config: Config = {
  path: '/api/supervisor/promoters/:id',
};
