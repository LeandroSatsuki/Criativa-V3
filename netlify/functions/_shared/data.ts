import { getEnv } from './env';
import { getJsonStore } from './storage';
import { getBrasiliaDate, getBrasiliaISO } from './time';
import type { Role, User } from '../../../src/types';
import { createHash } from 'node:crypto';

type SheetRow = {
  c?: Array<{ v?: string | number | null } | null>;
};

type SheetTable = {
  rows: SheetRow[];
};

export type AppData = {
  schemaVersion?: number;
  industries: string[];
  promoters: Array<{
    id: string;
    name: string;
    user: string;
    pass: string;
    region: string;
    role?: Role;
  }>;
  stores: Array<{
    id: string;
    name: string;
    region: string;
    responsible: string;
  }>;
  timestamp: string | null;
};

type ProvisionalUser = {
  id?: string;
  name?: string;
  user?: string;
  passHash?: string;
  region?: string;
  storeResponsible?: string;
  role?: Role;
  expiresAt?: string;
};

const CONFIG_SCHEMA_VERSION = 2;
const defaultIndustries = ['Veneza', 'Idealpan', 'Maricota', 'VidaVeg'];
const configStore = getJsonStore('criativa-config');

const parseSupervisorUsers = () => {
  const raw = getEnv('BACKEND_SUPERVISOR_USERS') || '';
  return new Set(
    raw
      .split(',')
      .map((value) => value.toLowerCase().trim())
      .filter(Boolean),
  );
};

const normalizeRole = (value: unknown): Role | undefined => {
  const normalized = String(value || '').toUpperCase().trim();
  if (normalized === 'SUPERVISOR') return 'SUPERVISOR';
  if (normalized === 'FIELD_OPS') return 'FIELD_OPS';
  return undefined;
};

const normalizeCredential = (value: string) => value.toLowerCase().trim();

const hashCredential = (value: string) =>
  createHash('sha256').update(normalizeCredential(value)).digest('hex');

const normalizeProvisionalUsers = (users: ProvisionalUser[], defaultRole: Role) =>
  users
    .map((user) => ({
      id: String(user.id || user.user || '').toLowerCase().trim(),
      name: String(user.name || '').trim(),
      user: String(user.user || '').toLowerCase().trim(),
      passHash: String(user.passHash || '').toLowerCase().trim(),
      region: String(user.region || (defaultRole === 'SUPERVISOR' ? 'SUPERVISOR' : '')).trim(),
      storeResponsible: String(user.storeResponsible || '').trim(),
      role: normalizeRole(user.role) || defaultRole,
      expiresAt: user.expiresAt ? String(user.expiresAt).trim() : '',
    }))
    .filter((user) => {
      if (!user.id || !user.name || !user.user || !user.passHash || !user.region) return false;
      if (!/^[a-f0-9]{64}$/.test(user.passHash)) return false;
      if (!user.expiresAt) return true;

      const expiration = new Date(user.expiresAt).getTime();
      return Number.isFinite(expiration) && expiration > Date.now();
    });

const parseDelimitedProvisionalUsers = (raw: string): ProvisionalUser[] =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, name, user, passHash, region, roleOrExpiresAt, expiresAt, storeResponsible] = line
        .split('|')
        .map((value) => value?.trim() || '');
      const role = normalizeRole(roleOrExpiresAt);
      return {
        id,
        name,
        user,
        passHash,
        region,
        role,
        expiresAt: role ? expiresAt : roleOrExpiresAt,
        storeResponsible,
      };
    });

const parseProvisionalUsersFromEnv = (envName: string, defaultRole: Role) => {
  const raw = getEnv(envName) || '';
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as ProvisionalUser[] | ProvisionalUser;
    const users = Array.isArray(parsed) ? parsed : [parsed];
    return normalizeProvisionalUsers(users, defaultRole);
  } catch {
    return normalizeProvisionalUsers(parseDelimitedProvisionalUsers(raw), defaultRole);
  }
};

const parseProvisionalUsers = () => [
  ...parseProvisionalUsersFromEnv('BACKEND_PROVISIONAL_SUPERVISORS', 'SUPERVISOR'),
  ...parseProvisionalUsersFromEnv('BACKEND_PROVISIONAL_USERS', 'FIELD_OPS'),
];

export const getProvisionalSupervisorDiagnostics = () => {
  const raw = getEnv('BACKEND_PROVISIONAL_SUPERVISORS') || '';
  const rawUsers = getEnv('BACKEND_PROVISIONAL_USERS') || '';
  const provisionalSupervisors = parseProvisionalUsersFromEnv('BACKEND_PROVISIONAL_SUPERVISORS', 'SUPERVISOR');
  const provisionalUsers = parseProvisionalUsersFromEnv('BACKEND_PROVISIONAL_USERS', 'FIELD_OPS');
  return {
    configured: Boolean(raw.trim()),
    validCount: provisionalSupervisors.length,
    provisionalUsers: {
      configured: Boolean(rawUsers.trim()),
      validCount: provisionalUsers.length,
    },
  };
};

const resolvePromoterRole = (promoter: { id: string; user: string; region: string; role?: Role }): Role => {
  const envSupervisors = parseSupervisorUsers();
  if (promoter.role) return promoter.role;
  if (promoter.region.toUpperCase().trim() === 'SUPERVISOR') return 'SUPERVISOR';
  if (envSupervisors.has(promoter.user) || envSupervisors.has(promoter.id)) return 'SUPERVISOR';
  return 'FIELD_OPS';
};

const isCompleteConfig = (data: AppData | null | undefined) =>
  Boolean(
    data?.schemaVersion === CONFIG_SCHEMA_VERSION &&
    data.industries?.length &&
    data.promoters?.length &&
    data.stores?.length,
  );

const hasOperationalData = (data: AppData | null | undefined) =>
  Boolean(data?.industries?.length && data.promoters?.length && data.stores?.length);

const parseSheet = (text: string) => {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Resposta da planilha inválida');
  }
  return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { table?: SheetTable };
};

const normalizeColumnName = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

const findColumnIndex = (table: SheetTable | null, aliases: string[], fallback: number) => {
  const headers = table?.rows?.[0]?.c?.map((cell) => normalizeColumnName(cell?.v)) || [];
  const normalizedAliases = aliases.map(normalizeColumnName);
  const index = headers.findIndex((header) => normalizedAliases.includes(header));
  return index >= 0 ? index : fallback;
};

const getRowValue = (row: SheetRow, columnIndex: number) => String(row.c?.[columnIndex]?.v || '').trim();

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
      role: normalizeRole(row.c?.[5]?.v),
    }))
    .filter((p) => p.user && p.user !== 'usuario') ?? [];

  const storeIdColumn = findColumnIndex(storesTable, ['ID_LOJA', 'CODIGO_LOJA', 'ID'], 0);
  const storeNameColumn = findColumnIndex(storesTable, [
    'NOME_LOJA',
    'NOME_DA_LOJA',
    'NOME_DO_PDV',
    'NOME_PDV',
    'PDV',
    'LOJA',
  ], 1);
  const storeRegionColumn = findColumnIndex(storesTable, ['REGIAO', 'REGIONAL', 'UF', 'CIDADE'], 2);
  const storeResponsibleColumn = findColumnIndex(storesTable, ['PROMOTOR', 'RESPONSAVEL', 'RESPONSAVEL_LOJA'], 11);

  const stores = storesTable?.rows
    .map((row) => ({
      id: getRowValue(row, storeIdColumn),
      name: getRowValue(row, storeNameColumn),
      region: getRowValue(row, storeRegionColumn),
      responsible: getRowValue(row, storeResponsibleColumn),
    }))
    .filter((store) => store.name && normalizeColumnName(store.name) !== 'NOMELOJA') ?? [];

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    industries: industries.length > 0 ? industries : defaultIndustries,
    promoters,
    stores,
    timestamp: getBrasiliaDate().toISOString(),
  };
};

export const getAppData = async () => {
  const cached = await configStore.get<AppData>('latest');
  if (isCompleteConfig(cached)) return cached;

  const fresh = await mapConfig();
  if (hasOperationalData(fresh)) {
    await configStore.set('latest', fresh);
    return fresh;
  }

  if (hasOperationalData(cached)) return cached;

  await configStore.set('latest', fresh);
  return fresh;
};

export const refreshAppData = async () => {
  const fresh = await mapConfig();
  if (hasOperationalData(fresh)) {
    await configStore.set('latest', fresh);
  }
  return fresh;
};

export const getStoresForUser = (data: AppData, user: User) => {
  const promoters = data.promoters || [];
  const allStores = data.stores || [];

  if (user.id === '0' || user.role === 'SUPERVISOR') {
    return allStores;
  }

  const promoter = promoters.find((p) => p.id === user.id);
  const promoterName = user.storeResponsible || promoter?.name || user.name || '';
  const regional = promoter?.region || user.region || '';

  const myStores = allStores.filter((store) => store.responsible === promoterName);
  if (myStores.length > 0) return myStores;

  return allStores.filter((store) =>
    store.region.toLowerCase().includes(regional.toLowerCase()),
  );
};

export const findUserByCredentials = async (userName: string, password: string) => {
  const data = await getAppData();
  const u = normalizeCredential(userName);
  const p = normalizeCredential(password);

  const found = data.promoters.find((promoter) => promoter.user === u && promoter.pass === p);
  if (!found) {
    const provisional = parseProvisionalUsers().find(
      (user) => user.user === u && user.passHash === hashCredential(p),
    );

    if (!provisional) return null;

    return {
      id: provisional.id,
      name: provisional.name,
      role: provisional.role,
      region: provisional.region,
      storeResponsible: provisional.storeResponsible,
      user: provisional.user,
    } as User;
  }

  const role = resolvePromoterRole(found);
  return {
    id: found.id,
    name: found.name,
    role,
    region: found.region,
    user: found.user,
  } as User;
};
