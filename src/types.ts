export const STORAGE_KEY = 'criativa_v5_state';

export enum SectionId {
  Dashboard = 'DASHBOARD',
  CheckIn = 'CHECKIN',
  Facade = 'FACHADA',
  Antes = 'ANTES',
  Estoque = 'ESTOQUE',
  Depois = 'DEPOIS',
  Trocas = 'TROCAS',
  CheckOut = 'CHECKOUT',
  Sync = 'SINCRONIZACAO',
  Supervisor = 'SUPERVISOR'
}

export type Role = 'FIELD_OPS' | 'SUPERVISOR';

export interface User {
  id: string;
  name: string;
  role: Role;
  region?: string;
  user: string;
}

export type Industry = string;

export interface VisitState {
  user: User | null;
  currentStore: string;
  currentStoreId: string;
  step: SectionId;
  checkInDone: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  selectedIndustry: Industry | null;
  tasks: Record<string, boolean>;
  photos: Record<string, string[]>;
  stockQuantities: Record<string, string>;
  aiResults: Record<string, any>;
  hasReturns: boolean | null;
  availableStores: any[];
  industries: string[];
}
