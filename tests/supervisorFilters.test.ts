import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupervisorPromoterOverview } from '../src/types.ts';
import { filterSupervisorPromoters } from '../src/services/supervisorFilters.ts';

const promoter = (
  overrides: Partial<SupervisorPromoterOverview> = {},
): SupervisorPromoterOverview => ({
  id: 'PROMOTOR-1',
  name: 'José da Silva',
  region: 'Vitória',
  status: 'PENDENTE',
  online: false,
  progress: 50,
  store: 'Loja Centro',
  lastSync: '10:00',
  visits: { completed: 1, total: 2 },
  pendingSyncVisits: 1,
  lastVisitId: 'VISIT-1',
  ...overrides,
});

test('card de concluidas lista promotores que contribuiram para o total', () => {
  const data = [
    promoter(),
    promoter({ id: 'PROMOTOR-2', visits: { completed: 0, total: 1 } }),
  ];

  assert.deepEqual(
    filterSupervisorPromoters(data, 'completed').map((item) => item.id),
    ['PROMOTOR-1'],
  );
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
  const data = [promoter(), promoter({ id: 'PROMOTOR-2', name: 'Maria', store: 'Loja Norte' })];

  assert.equal(filterSupervisorPromoters(data, 'all', 'jose').length, 1);
  assert.equal(filterSupervisorPromoters(data, 'all', 'vitoria').length, 2);
  assert.equal(filterSupervisorPromoters(data, 'all', 'centro')[0]?.id, 'PROMOTOR-1');
});
