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
  storeResponsible?: string;
  user: string;
}

export type Industry = string;

export interface IndustryExecution {
  industry: Industry;
  status?: 'aberto' | 'concluido';
  tasks: Record<string, boolean>;
  photos: Record<string, string[]>;
  stockQuantities: Record<string, string>;
  aiResults: Record<string, any>;
  hasReturns: boolean | null;
  openedAt?: string;
  completedAt?: string | null;
}

export interface VisitState {
  user: User | null;
  visitId?: string | null;
  currentStore: string;
  currentStoreId: string;
  step: SectionId;
  checkInDone: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  syncStatus?: 'pendente' | 'enviando' | 'enviado' | 'erro' | 'reenviar' | null;
  syncError?: string | null;
  selectedIndustry: Industry | null;
  tasks: Record<string, boolean>;
  photos: Record<string, string[]>;
  stockQuantities: Record<string, string>;
  aiResults: Record<string, any>;
  hasReturns: boolean | null;
  industryExecutions?: Record<string, IndustryExecution>;
  availableStores: any[];
  industries: string[];
}

export interface SupervisorTimelinePoint {
  time: string;
  totalVisits: number;
  completedVisits: number;
  pendingSyncVisits: number;
}

export interface SupervisorPromoterOverview {
  id: string;
  name: string;
  region: string;
  status: 'CONCLUÍDO' | 'EM ANDAMENTO' | 'PENDENTE' | 'EM ROTA';
  online: boolean;
  progress: number;
  store: string;
  lastSync: string;
  visits: {
    completed: number;
    total: number;
  };
  pendingSyncVisits: number;
  lastVisitId: string | null;
}

export interface SupervisorDashboardSummary {
  totalPromoters: number;
  onlinePromoters: number;
  offlinePromoters: number;
  onRoutePromoters: number;
  inProgressPromoters: number;
  completedPromoters: number;
  pendingPromoters: number;
  pendingSyncVisits: number;
  totalVisits: number;
  completedVisits: number;
  averageVisitTime: string;
  lastUpdated: string;
}

export interface SupervisorDashboardResponse {
  summary: SupervisorDashboardSummary;
  timeline: SupervisorTimelinePoint[];
  promoters: SupervisorPromoterOverview[];
  lastUpdated: string;
}

export interface SupervisorPromoterDetailRouteItem {
  id: string;
  visitId: string;
  name: string;
  time: string;
  status: 'CONCLUÍDO' | 'EM ANDAMENTO' | 'PENDENTE';
  tasks: number;
  photos: number;
  syncStatus: 'pendente' | 'enviando' | 'enviado' | 'erro' | 'reenviar';
}

export interface SupervisorPromoterDetailResponse {
  metrics: {
    efficiency: string;
    workingTime: string;
    completedVisits: number;
    totalVisits: number;
    pendingSyncVisits: number;
    averageDuration: string;
  };
  route: SupervisorPromoterDetailRouteItem[];
}
