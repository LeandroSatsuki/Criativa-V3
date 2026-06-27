import { getStore } from '@netlify/blobs';
import { getEnv } from './env';
import { getBrasiliaDate, getBrasiliaISO } from './time';
import type { Role, User } from '../../../src/types';

type SheetRow = {
  c?: Array<{ v?: string | number | null } | null>;
};

type SheetTable = {
  rows: SheetRow[];
};

export type AppData = {
  industries: string[];
  promoters: Array<{
    id: string;
    name: string;
    user: string;
    pass: string;
    region: string;
  }>;
  stores: Array<{
    id: string;
    name: string;
    region: string;
    responsible: string;
  }>;
  timestamp: string | null;
};

const defaultIndustries = ['Veneza', 'Idealpan', 'Maricota', 'VidaVeg'];
const configStore = getStore({ name: 'criativa-config', consistency: 'strong' });

const parseSheet = (text: string) => {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Resposta da planilha inválida');
  }
  return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { table?: SheetTable };
};

const fetchSheetData = async (sheetName: string) => {
  const spreadsheetId = getEnv('BACKEND_GOOGLE_SHEETS_ID');
  if (!spreadsheetId) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    const json = parseSheet(text);
    return json.table || null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const mapConfig = async (): Promise<AppData> => {
  const industriesTable = await fetchSheetData('INDUSTRIAS');
  const promotersTable = await fetchSheetData('CADASTRO_PROMOTORES');
  const storesTable = await fetchSheetData('CADASTRO_LOJAS');

  const industries = industriesTable?.rows
    .map((row) => row.c?.[0]?.v)
    .filter((value): value is string => Boolean(value) && value !== 'INDUSTRIAS') ?? [];

  const promoters = promotersTable?.rows
    .map((row) => ({
      id: String(row.c?.[0]?.v || ''),
      name: String(row.c?.[1]?.v || ''),
      user: String(row.c?.[2]?.v || '').toLowerCase().trim(),
      pass: String(row.c?.[3]?.v || '').toLowerCase().trim(),
      region: String(row.c?.[4]?.v || ''),
    }))
    .filter((p) => p.user && p.user !== 'usuario') ?? [];

  const stores = storesTable?.rows
    .map((row) => ({
      id: String(row.c?.[0]?.v || ''),
      name: String(row.c?.[1]?.v || ''),
      region: String(row.c?.[2]?.v || ''),
      responsible: String(row.c?.[11]?.v || ''),
    }))
    .filter((store) => store.name && store.name !== 'NOME_LOJA') ?? [];

  return {
    industries: industries.length > 0 ? industries : defaultIndustries,
    promoters,
    stores,
    timestamp: getBrasiliaDate().toISOString(),
  };
};

export const getAppData = async () => {
  const cached = await configStore.get('latest', { type: 'json' }) as AppData | null;
  if (cached?.industries?.length) return cached;

  const fresh = await mapConfig();
  await configStore.setJSON('latest', fresh);
  return fresh;
};

export const refreshAppData = async () => {
  const fresh = await mapConfig();
  await configStore.setJSON('latest', fresh);
  return fresh;
};

export const getStoresForUser = (data: AppData, user: User) => {
  const promoters = data.promoters || [];
  const allStores = data.stores || [];

  if (user.id === '0' || user.role === 'SUPERVISOR') {
    return allStores;
  }

  const promoter = promoters.find((p) => p.id === user.id);
  const promoterName = promoter?.name || user.name || '';
  const regional = promoter?.region || user.region || '';

  const myStores = allStores.filter((store) => store.responsible === promoterName);
  if (myStores.length > 0) return myStores;

  return allStores.filter((store) =>
    store.region.toLowerCase().includes(regional.toLowerCase()),
  );
};

export const findUserByCredentials = async (userName: string, password: string) => {
  const data = await getAppData();
  const u = userName.toLowerCase().trim();
  const p = password.toLowerCase().trim();

  const found = data.promoters.find((promoter) => promoter.user === u && promoter.pass === p);
  if (!found) return null;

  const role: Role = found.region.toUpperCase() === 'SUPERVISOR' ? 'SUPERVISOR' : 'FIELD_OPS';
  return {
    id: found.id,
    name: found.name,
    role,
    region: found.region,
    user: found.user,
  } as User;
};
