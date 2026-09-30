import assert from 'node:assert/strict';
import test from 'node:test';
import type { sheets_v4 } from 'googleapis';
import { SheetsWriter } from '../src/sheets.ts';

test('atualiza linha existente pela ID_VISITA', async () => {
  const updates: any[] = [];
  const sheets = {
    spreadsheets: { values: {
      get: async () => ({ data: { values: [['ID_VISITA', 'NOME_LOJA'], ['VISIT-1', 'Antiga']] } }),
      update: async (request: any) => { updates.push(request); return { data: {} }; },
      append: async () => { throw new Error('nao deve incluir outra linha'); },
    } },
  } as unknown as sheets_v4.Sheets;

  const receipt = await new SheetsWriter(sheets, 'sheet-id', 'Visitas').upsert({
    ID_VISITA: 'VISIT-1',
    NOME_LOJA: 'Nova',
  });

  assert.deepEqual(receipt, { rowAction: 'updated', rowId: '2' });
  assert.equal(updates[0].range, "'Visitas'!A2:B2");
  assert.deepEqual(updates[0].requestBody.values, [['VISIT-1', 'Nova']]);
});

test('inclui somente quando ID_VISITA ainda nao existe', async () => {
  let appended = 0;
  const sheets = {
    spreadsheets: { values: {
      get: async () => ({ data: { values: [['ID_VISITA', 'NOME_LOJA']] } }),
      update: async () => ({ data: {} }),
      append: async () => { appended += 1; return { data: { updates: { updatedRange: 'Visitas!A2:B2' } } }; },
    } },
  } as unknown as sheets_v4.Sheets;

  const receipt = await new SheetsWriter(sheets, 'sheet-id', 'Visitas').upsert({
    ID_VISITA: 'VISIT-2',
    NOME_LOJA: 'Centro',
  });

  assert.equal(appended, 1);
  assert.deepEqual(receipt, { rowAction: 'created', rowId: 'Visitas!A2:B2' });
});
