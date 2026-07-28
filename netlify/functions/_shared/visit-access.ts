type VisitAccessRecord = {
  payload?: any;
};

type VisitAccessIdentity = {
  sub: string;
  role: string;
};

export const getVisitOwnerId = (visit: VisitAccessRecord) =>
  String(visit.payload?.user?.id || visit.payload?.draftOwnerId || '').trim();

export const canAccessVisit = (visit: VisitAccessRecord, identity: VisitAccessIdentity) =>
  identity.role === 'SUPERVISOR' || getVisitOwnerId(visit) === String(identity.sub || '').trim();
