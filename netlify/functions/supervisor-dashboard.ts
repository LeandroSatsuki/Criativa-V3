import type { Config, Context } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { getAppData } from './_shared/data';
import { listVisits } from './_shared/visits';

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });

export default async (request: Request, _context: Context) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authenticate(request);
  if (!auth || auth.role !== 'SUPERVISOR') {
    return json({ error: 'Acesso restrito ao supervisor' }, 403);
  }

  const [data, visits] = await Promise.all([getAppData(), listVisits()]);
  const byPromoter = new Map<string, typeof visits>();

  for (const visit of visits) {
    const promoterId = String(visit.payload?.user?.id || visit.payload?.user?.user || 'unknown');
    const current = byPromoter.get(promoterId) || [];
    current.push(visit);
    byPromoter.set(promoterId, current);
  }

  return json(data.promoters.map((promoter) => {
    const promoterVisits = byPromoter.get(promoter.id) || [];
    const latest = promoterVisits.at(-1);
    const completed = promoterVisits.filter((visit) => visit.syncStatus === 'enviado').length;
    const inProgress = promoterVisits.some((visit) => visit.syncStatus === 'enviando');
    const latestTime = latest?.updatedAt || latest?.createdAt || null;

    return {
      id: promoter.id,
      name: promoter.name,
      region: promoter.region,
      status: latest?.syncStatus === 'enviado'
        ? 'CONCLUÍDO'
        : latest?.syncStatus === 'erro'
          ? 'PENDENTE'
          : inProgress
            ? 'EM ANDAMENTO'
            : 'PENDENTE',
      online: Boolean(latestTime && (Date.now() - new Date(latestTime).getTime()) < 15 * 60 * 1000),
      progress: promoterVisits.length === 0 ? 0 : Math.min(100, Math.round((completed / promoterVisits.length) * 100)),
      store: latest?.payload?.currentStore || 'Sem loja recente',
      lastSync: latestTime ? formatTime(latestTime) : '--:--',
      visits: {
        completed,
        total: promoterVisits.length,
      },
    };
  }));
};

export const config: Config = {
  path: '/api/supervisor/dashboard',
};
