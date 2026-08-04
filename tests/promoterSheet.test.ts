import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findColumnIndex,
  getTableDataRows,
  mapPromotersTable,
  PROMOTER_SHEET_NAMES,
  type SheetTable,
} from '../netlify/functions/_shared/promoter-sheet.ts';

test('usa os rotulos do GViz e preserva a primeira linha de dados', () => {
  const gvizTable = {
    cols: [
      { label: 'ID_LOJA' },
      { label: 'GRUPO_REDE' },
      { label: 'NOME_LOJA' },
    ],
    rows: [
      { c: [{ v: '1' }, { v: 'EXTRABOM' }, { v: 'EXTRABOM SUPERMERCADOS - JD AMERICA' }] },
    ],
  } satisfies SheetTable;

  assert.equal(findColumnIndex(gvizTable, ['NOME_LOJA'], 1), 2);
  assert.equal(getTableDataRows(gvizTable).length, 1);
  assert.equal(getTableDataRows(gvizTable)[0].c?.[2]?.v, 'EXTRABOM SUPERMERCADOS - JD AMERICA');
});

const table = (rows: Array<Array<string | number>>) => ({
  rows: rows.map((values) => ({ c: values.map((value) => ({ v: value })) })),
}) satisfies SheetTable;

test('prioriza a aba real e mantém compatibilidade com o nome antigo', () => {
  assert.deepEqual(PROMOTER_SHEET_NAMES, ['PROMOTORES', 'CADASTRO_PROMOTORES']);
});

test('mapeia o cadastro atual sem transformar o cabeçalho em login', () => {
  const promoters = mapPromotersTable(table([
    ['ID_PROMOTOR', 'NOME', 'USUÁRIO', 'SENHA', 'REGIONAL'],
    [3, 'Promotora Atual', 'Promotora.Atual', 'SenhaAtual', 'Vitória'],
  ]));

  assert.deepEqual(promoters, [{
    id: '3',
    name: 'Promotora Atual',
    user: 'promotora.atual',
    pass: 'senhaatual',
    region: 'Vitória',
    role: undefined,
  }]);
});

test('reconhece ROLE por cabeçalho mesmo com colunas reordenadas', () => {
  const promoters = mapPromotersTable(table([
    ['NOME_PROMOTOR', 'LOGIN', 'ROLE', 'REGIÃO', 'PASSWORD', 'CODIGO_PROMOTOR'],
    ['Supervisora', 'supervisora', 'SUPERVISOR', 'Grande Vitória', 'Segredo', 900],
    ['Promotor', 'promotor', 'FIELD_OPS', 'Serra', 'Segredo2', 901],
  ]));

  assert.equal(promoters[0].role, 'SUPERVISOR');
  assert.equal(promoters[0].id, '900');
  assert.equal(promoters[1].role, 'FIELD_OPS');
  assert.equal(promoters[1].region, 'Serra');
});

test('ignora linhas incompletas sem afetar cadastros válidos', () => {
  const promoters = mapPromotersTable(table([
    ['ID_PROMOTOR', 'NOME', 'USUARIO', 'SENHA', 'REGIONAL', 'ROLE'],
    ['', 'Sem ID', 'sem.id', 'senha', 'Serra', 'FIELD_OPS'],
    [12, 'Cadastro Válido', 'cadastro.valido', 'senha', 'Vila Velha', 'outro'],
  ]));

  assert.equal(promoters.length, 1);
  assert.equal(promoters[0].id, '12');
  assert.equal(promoters[0].role, undefined);
});
