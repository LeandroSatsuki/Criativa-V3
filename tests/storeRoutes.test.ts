import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBrasiliaWeekday,
  getStoresForUser,
  parseRoutePromoterIds,
} from '../netlify/functions/_shared/store-routes.ts';
import type { AppData } from '../netlify/functions/_shared/data.ts';
import type { User } from '../src/types.ts';

const promoter: User = {
  id: '123',
  name: 'Laila Gabriele Borges dos Santos',
  user: 'laila.santos',
  role: 'FIELD_OPS',
  region: 'Vitoria',
};

const data: AppData = {
  industries: ['VENEZA'],
  promoters: [{
    id: '123',
    name: promoter.name,
    user: promoter.user,
    pass: 'senha',
    region: 'Vitoria',
    phone: '',
  }],
  stores: [
    { id: '1', name: 'Rota de segunda', region: 'Vitoria', responsible: 'Nome antigo', routePromoterId: '123', routeDays: [1] },
    { id: '2', name: 'Rota de terca', region: 'Vitoria', responsible: promoter.name, routePromoterId: '123', routeDays: [2] },
    { id: '3', name: 'Outro promotor', region: 'Vitoria', responsible: promoter.name, routePromoterId: '999', routeDays: [1] },
    { id: '4', name: 'Compatibilidade por nome', region: 'Vitoria', responsible: '  LAILA GABRIÉLE BORGES DOS SANTOS ', routeDays: [1] },
    { id: '5', name: 'Sem dia', region: 'Vitoria', responsible: promoter.name, routePromoterId: '123', routeDays: [] },
    { id: '6', name: 'Rota de sabado', region: 'Vitoria', responsible: promoter.name, routePromoterId: '123', routeDays: [6] },
    { id: '7', name: 'Rota compartilhada', region: 'Vitoria', responsible: 'Promotor principal', routePromoterId: '999', routePromoterIds: ['999', '123'], routeDays: [1] },
  ],
  timestamp: null,
};

test('calcula o dia da semana no fuso de Brasilia', () => {
  assert.equal(getBrasiliaWeekday(new Date('2026-08-10T02:30:00.000Z')), 0);
  assert.equal(getBrasiliaWeekday(new Date('2026-08-10T03:30:00.000Z')), 1);
});

test('normaliza lista de IDs adicionais sem duplicar atribuicoes', () => {
  assert.deepEqual(
    parseRoutePromoterIds('111', '123, 111; 125|126\n127'),
    ['111', '123', '125', '126', '127'],
  );
});

test('promotor recebe somente as lojas atribuidas e marcadas no dia', () => {
  const monday = new Date('2026-08-10T12:00:00.000Z');
  const stores = getStoresForUser(data, promoter, monday);

  assert.deepEqual(stores.map((store) => store.id), ['1', '4', '7']);
});

test('dois promotores recebem a mesma loja sem duplicar o cadastro', () => {
  const monday = new Date('2026-08-10T12:00:00.000Z');
  const secondPromoter: User = {
    id: '999',
    name: 'Promotor principal',
    user: 'principal',
    role: 'FIELD_OPS',
    region: 'Vitoria',
  };

  assert.deepEqual(getStoresForUser(data, promoter, monday).filter((store) => store.id === '7').map((store) => store.id), ['7']);
  assert.deepEqual(getStoresForUser(data, secondPromoter, monday).filter((store) => store.id === '7').map((store) => store.id), ['7']);
});

test('promotor inativo permanece cadastrado mas nao recebe rota', () => {
  const inactiveData: AppData = {
    ...data,
    promoters: data.promoters.map((item) => ({ ...item, status: 'INATIVO' })),
  };

  assert.deepEqual(getStoresForUser(inactiveData, promoter, new Date('2026-08-10T12:00:00.000Z')), []);
});

test('promotor recebe as lojas atribuidas e marcadas no sabado', () => {
  const saturday = new Date('2026-08-08T12:00:00.000Z');

  assert.deepEqual(getStoresForUser(data, promoter, saturday).map((store) => store.id), ['6']);
});

test('loja sem X nao aparece e nao existe fallback regional', () => {
  const sunday = new Date('2026-08-09T12:00:00.000Z');

  assert.deepEqual(getStoresForUser(data, promoter, sunday), []);
});

test('supervisor continua visualizando todas as lojas', () => {
  const supervisor: User = {
    id: '900',
    name: 'Supervisora',
    user: 'supervisora',
    role: 'SUPERVISOR',
    region: 'SUPERVISOR',
  };

  assert.equal(getStoresForUser(data, supervisor).length, data.stores.length);
});
