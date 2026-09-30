import type { SectionId, VisitState } from '../types';

const DASHBOARD_SECTION = 'DASHBOARD' as SectionId;
const CHECK_IN_SECTION = 'CHECKIN' as SectionId;
const FACADE_SECTION = 'FACHADA' as SectionId;

type VisitLifecycleState = Partial<Pick<
  VisitState,
  | 'visitId'
  | 'currentStore'
  | 'currentStoreId'
  | 'checkInDone'
  | 'checkInTime'
  | 'checkOutTime'
  | 'selectedIndustry'
  | 'tasks'
  | 'photos'
  | 'stockQuantities'
  | 'aiResults'
  | 'hasReturns'
  | 'returnsPhotosByIndustry'
  | 'industryExecutions'
  | 'step'
>>;

export const hasEntrancePhoto = (state: VisitLifecycleState) =>
  (state.photos?.[FACADE_SECTION]?.length || 0) > 0;

export const hasStartedVisit = (state: VisitLifecycleState) => Boolean(
  state.checkInDone
  || state.tasks?.[CHECK_IN_SECTION]
  || hasEntrancePhoto(state),
);

export const recoverUnstartedVisit = <T extends VisitLifecycleState>(state: T): T => {
  if (hasStartedVisit(state)) return state;

  return {
    ...state,
    visitId: null,
    currentStore: '',
    currentStoreId: '',
    checkInDone: false,
    checkInTime: null,
    checkOutTime: null,
    selectedIndustry: null,
    tasks: {},
    photos: {},
    stockQuantities: {},
    aiResults: {},
    hasReturns: null,
    returnsPhotosByIndustry: {},
    industryExecutions: {},
    step: DASHBOARD_SECTION,
  };
};
