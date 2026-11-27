// One support exception explicitly authorized by the operator on 2026-11-24.
// This is not a general queue-clearing capability.
export const AUTHORIZED_DISCARD = { ownerId: '101', login: 'lorena.costa', visitId: 'VISIT-9ADC2CA2' } as const;
const markerKey = (ownerId: string, visitId: string) => `criativa-discarded-visit:${encodeURIComponent(ownerId)}:${visitId}`;

export const canDiscardAuthorizedVisit = (user: { id?: string; user?: string } | null | undefined, visitId: string) =>
  String(user?.id) === AUTHORIZED_DISCARD.ownerId && user?.user === AUTHORIZED_DISCARD.login && visitId === AUTHORIZED_DISCARD.visitId;

export const wasVisitDiscarded = (ownerId: string, visitId?: string | null) => {
  if (!visitId) return false;
  try { return localStorage.getItem(markerKey(ownerId, visitId)) === 'authorized-discard-2026-11-24'; }
  catch { return false; }
};

export const markAuthorizedVisitDiscarded = (user: { id?: string; user?: string }, visitId: string) => {
  if (!canDiscardAuthorizedVisit(user, visitId)) throw new Error('Remocao nao autorizada para este registro.');
  localStorage.setItem(markerKey(String(user.id), visitId), 'authorized-discard-2026-11-24');
};
