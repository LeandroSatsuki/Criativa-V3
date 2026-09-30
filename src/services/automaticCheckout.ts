import type { VisitState } from '../types';
import { hasStartedVisit } from './visitLifecycle.ts';

export const getCheckoutDeadline = (checkInTime: string | null) => {
  if (!checkInTime) return null;
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(checkInTime) ? checkInTime : `${checkInTime}-03:00`;
  const startedAt = new Date(timestamp);
  if (!Number.isFinite(startedAt.getTime())) return null;
  const day = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(startedAt);
  let deadline = new Date(`${day}T18:00:00-03:00`);
  // An exceptional visit started after the cutoff belongs to the next closing cycle.
  if (startedAt.getTime() > deadline.getTime()) deadline = new Date(deadline.getTime() + 86_400_000);
  return deadline;
};

export const buildAutomaticCheckout = (state: VisitState, now = new Date()): VisitState | null => {
  if (state.user?.role !== 'FIELD_OPS' || !state.visitId || !state.currentStoreId
    || !hasStartedVisit(state) || state.checkOutTime) return null;
  const deadline = getCheckoutDeadline(state.checkInTime);
  if (!deadline || now.getTime() < deadline.getTime()) return null;
  return {
    ...state,
    checkOutTime: deadline.toISOString(),
    automaticCheckout: {
      reason: 'end_of_day',
      scheduledAt: deadline.toISOString(),
      recordedAt: now.toISOString(),
    },
  };
};
