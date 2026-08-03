import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSupervisorDashboard,
  buildSupervisorPromoterDetail,
} from '../netlify/functions/_shared/supervisor.ts';
import type { AppData } from '../netlify/functions/_shared/data.ts';
import type { VisitRecord } from '../netlify/functions/_shared/visits.ts';

const visit = (visitId: string, user: any, photos: any): VisitRecord => ({
  visitId,
  createdAt: '2026-08-03T10:00:00-03:00',
  updatedAt: '2026-08-03T11:00:00-03:00',
  syncStatus: 'enviado',
  payload: {
    visitId,
    user,
    currentStore: 'Loja Teste',
    checkInTime: '2026-08-03T10:00:00-03:00',
    checkOutTime: '2026-08-03T11:00:00-03:00',
    ...photos,
  },
});

const data: AppData = {
  industries: ['VENEZA'],
  stores: [{ id: '1', name: 'Loja Teste', region: 'Vitoria', responsible: 'Promotora' }],
  promoters: [
    { id: '3', name: 'Promotora', user: 'promotora', pass: 'senha', region: 'Vitoria' },
    { id: '115', name: 'Supervisora', user: 'supervisora', pass: 'senha', region: 'Serra', role: 'SUPERVISOR' },
  ],
  timestamp: '2026-08-03T09:00:00-03:00',
};

test('painel associa por usuario e preserva promotor historico sem listar supervisor', () => {
  const visits = [
    visit('VISIT-ATUAL', { id: 'id-antigo', user: 'promotora', name: 'Promotora' }, {}),
    visit('VISIT-HISTORICA', { id: 'temporario-antigo', user: 'temporario', name: 'Promotor Historico' }, {}),
  ];
  const dashboard = buildSupervisorDashboard(data, visits);

  assert.equal(dashboard.summary.totalVisits, 2);
  assert.equal(dashboard.promoters.length, 2);
  assert.equal(dashboard.promoters.find((item) => item.id === '3')?.visits.total, 1);
  assert.equal(dashboard.promoters.some((item) => item.id === 'temporario-antigo'), true);
  assert.equal(dashboard.promoters.some((item) => item.id === '115'), false);
});

test('detalhe conta fotos unicas no fluxo geral e por industria', () => {
  const record = visit('VISIT-FOTOS', { id: '3', user: 'promotora', name: 'Promotora' }, {
    photos: { FACHADA: ['foto-fachada'], ANTES: ['foto-repetida'] },
    industryExecutions: {
      VENEZA: { photos: { ANTES: ['foto-repetida', 'foto-antes-2'], DEPOIS: ['foto-depois'] } },
    },
  });

  const detail = buildSupervisorPromoterDetail([record]);
  assert.equal(detail.route[0].photos, 4);
});
