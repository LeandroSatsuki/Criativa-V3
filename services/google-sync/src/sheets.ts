import type { sheets_v4 } from 'googleapis';

const columnName = (index: number) => {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
};

const tabRange = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

export class SheetsWriter {
  constructor(
    private readonly sheets: sheets_v4.Sheets,
    private readonly spreadsheetId: string,
    private readonly tab: string,
  ) {}

  async upsert(row: Record<string, string | number> & { ID_VISITA: string }) {
    const sheet = tabRange(this.tab);
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${sheet}!A:ZZ`,
    });
    const values = response.data.values || [];
    const headers = values[0]?.map(String) || [];
    const resolvedHeaders = headers.length ? headers : Object.keys(row);
    const idColumn = resolvedHeaders.indexOf('ID_VISITA');
    if (idColumn < 0) throw new Error('A planilha nao possui a coluna ID_VISITA.');
    const target = values.slice(1).findIndex((line) => String(line[idColumn] || '') === row.ID_VISITA);
    const output = resolvedHeaders.map((header) => row[header] ?? '');

    if (!headers.length) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheet}!A1:${columnName(resolvedHeaders.length - 1)}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [resolvedHeaders] },
      });
    }

    if (target >= 0) {
      const rowNumber = target + 2;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheet}!A${rowNumber}:${columnName(resolvedHeaders.length - 1)}${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [output] },
      });
      return { rowAction: 'updated' as const, rowId: String(rowNumber) };
    }

    const appended = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheet}!A:${columnName(resolvedHeaders.length - 1)}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [output] },
    });
    return { rowAction: 'created' as const, rowId: appended.data.updates?.updatedRange || '' };
  }
}
