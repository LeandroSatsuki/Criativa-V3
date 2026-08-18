import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupervisorPromoterOverview } from '../src/types.ts';
import { filterSupervisorPromoters } from '../src/services/supervisorFilters.ts';

const promoter = (
  overrides: Partial<SupervisorPromoterOverview> = {},
): SupervisorPromoterOverview => ({
  id: 'PROMOTOR-1',
  name: 'José da Silva',
  user: 'jose.silva',
  region: 'Vitória',
  phone: '(27) 99999-9999',
  registered: true,
  registrationStatus: 'ATIVO',
  activeToday: true,
  hasRouteToday: true,
  status: 'PENDENTE',
  online: false,
  progress: 50,
  store: 'Loja Centro',
  lastSync: '10:00',
  visits: { completed: 1, total: 2 },
  todayVisits: { completed: 1, pending: 1, total: 2, recorded: 1, extra: 0, duplicates: 0 },
  pendingSyncVisits: 1,
  lastVisitId: 'VISIT-1',
  ...overrides,
});

test('card de concluidas lista promotores que contribuiram para o total', () => {
  const data = [
    promoter(),
    promoter({ id: 'PROMOTOR-2', todayVisits: { completed: 0, pending: 1, total: 1, recorded: 0, extra: 0, duplicates: 0 } }),
  ];

  assert.deepEqual(
    filterSupervisorPromoters(data, 'completed').map((item) => item.id),
    ['PROMOTOR-1'],
  );
});

test('card de cadastrados exclui usuario somente historico', () => {
  const data = [
    promoter(),
    promoter({ id: 'INATIVO', registrationStatus: 'INATIVO', status: 'INATIVO' }),
    promoter({ id: 'HISTORICO', registered: false }),
  ];

  assert.deepEqual(
    filterSupervisorPromoters(data, 'active').map((item) => item.id),
    ['PROMOTOR-1', 'INATIVO'],
  );
});

test('inativo nao aparece como falta de atualizacao operacional', () => {
  const data = [
    promoter(),
    promoter({ id: 'INATIVO', registrationStatus: 'INATIVO', status: 'INATIVO', online: false }),
  ];

  assert.deepEqual(filterSupervisorPromoters(data, 'offline').map((item) => item.id), ['PROMOTOR-1']);
});

test('cards diarios usam somente contribuicoes de hoje', () => {
  const data = [
    promoter(),
    promoter({ id: 'ANTIGO', activeToday: false, hasRouteToday: false, todayVisits: { completed: 0, pending: 0, total: 0, recorded: 0, extra: 0, duplicates: 0 } }),
  ];

  assert.deepEqual(filterSupervisorPromoters(data, 'on_route').map((item) => item.id), ['PROMOTOR-1']);
  assert.deepEqual(filterSupervisorPromoters(data, 'pending').map((item) => item.id), ['PROMOTOR-1']);
});

test('card de pendencias considera visitas de sincronizacao por promotor', () => {
  const data = [
    promoter(),
    promoter({ id: 'PROMOTOR-2', pendingSyncVisits: 0 }),
  ];

  assert.deepEqual(
    filterSupervisorPromoters(data, 'sync_pending').map((item) => item.id),
    ['PROMOTOR-1'],
  );
});

test('busca combina nome, loja e regiao ignorando acentos', () => {
  const data = [promoter(), promoter({ id: 'PROMOTOR-2', name: 'Maria', user: 'maria', store: 'Loja Norte' })];

  assert.equal(filterSupervisorPromoters(data, 'all', 'jose').length, 1);
  assert.equal(filterSupervisorPromoters(data, 'all', 'vitoria').length, 2);
  assert.equal(filterSupervisorPromoters(data, 'all', 'centro')[0]?.id, 'PROMOTOR-1');
});
