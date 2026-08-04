export type PromoterRole = 'FIELD_OPS' | 'SUPERVISOR';

export type SheetRow = {
  c?: Array<{ v?: string | number | null } | null>;
};

export type SheetTable = {
  cols?: Array<{ label?: string | null } | null>;
  rows: SheetRow[];
};

export type SheetPromoter = {
  id: string;
  name: string;
  user: string;
  pass: string;
  region: string;
  role?: PromoterRole;
};

export const PROMOTER_SHEET_NAMES = ['PROMOTORES', 'CADASTRO_PROMOTORES'] as const;

export const normalizeRole = (value: unknown): PromoterRole | undefined => {
  const normalized = String(value || '').toUpperCase().trim();
  if (normalized === 'SUPERVISOR') return 'SUPERVISOR';
  if (normalized === 'FIELD_OPS') return 'FIELD_OPS';
  return undefined;
};

export const normalizeColumnName = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

export const findColumnIndex = (
  table: SheetTable | null,
  aliases: string[],
  fallback: number,
) => {
  const columnLabels = table?.cols?.map((column) => normalizeColumnName(column?.label)) || [];
  const headers = columnLabels.some(Boolean)
    ? columnLabels
    : table?.rows?.[0]?.c?.map((cell) => normalizeColumnName(cell?.v)) || [];
  const normalizedAliases = aliases.map(normalizeColumnName);
  const index = headers.findIndex((header) => normalizedAliases.includes(header));
  return index >= 0 ? index : fallback;
};

export const getTableDataRows = (table: SheetTable) => (
  table.cols?.some((column) => normalizeColumnName(column?.label))
    ? table.rows
    : table.rows.slice(1)
);

export const getRowValue = (row: SheetRow, columnIndex: number) =>
  String(row.c?.[columnIndex]?.v || '').trim();

export const mapPromotersTable = (table: SheetTable | null): SheetPromoter[] => {
  if (!table?.rows?.length) return [];

  const idColumn = findColumnIndex(table, ['ID_PROMOTOR', 'CODIGO_PROMOTOR', 'ID'], 0);
  const nameColumn = findColumnIndex(table, ['NOME', 'NOME_PROMOTOR', 'PROMOTOR'], 1);
  const userColumn = findColumnIndex(table, ['USUARIO', 'USER', 'LOGIN'], 2);
  const passwordColumn = findColumnIndex(table, ['SENHA', 'PASSWORD'], 3);
  const regionColumn = findColumnIndex(table, ['REGIONAL', 'REGIAO', 'UF'], 4);
  const roleColumn = findColumnIndex(table, ['ROLE', 'PERFIL', 'TIPO_USUARIO'], 5);

  return getTableDataRows(table)
    .map((row) => ({
      id: getRowValue(row, idColumn),
      name: getRowValue(row, nameColumn),
      user: getRowValue(row, userColumn).toLowerCase(),
      pass: getRowValue(row, passwordColumn).toLowerCase(),
      region: getRowValue(row, regionColumn),
      role: normalizeRole(getRowValue(row, roleColumn)),
    }))
    .filter((promoter) => promoter.id && promoter.name && promoter.user && promoter.pass);
};
