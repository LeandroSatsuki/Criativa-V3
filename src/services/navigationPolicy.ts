import type { Role, SectionId } from '../types';

const DASHBOARD_SECTION = 'DASHBOARD' as SectionId;
const CHECK_IN_SECTION = 'CHECKIN' as SectionId;
const SUPERVISOR_SECTION = 'SUPERVISOR' as SectionId;

export const resolveSessionSection = (
  role: Role | undefined,
  savedStep?: SectionId | null,
  hasActiveVisit = false,
): SectionId => {
  if (role === 'SUPERVISOR') return SUPERVISOR_SECTION;
  if (role === 'FIELD_OPS' && !hasActiveVisit) return CHECK_IN_SECTION;
  return savedStep || DASHBOARD_SECTION;
};
