const NAME = 'criativa-local-visit-writes';
export const hasLocalVisitLocks = () => typeof navigator !== 'undefined' && Boolean(navigator.locks?.request);
export const withLocalVisitLock = <T>(work: () => Promise<T>): Promise<T> =>
  hasLocalVisitLocks() ? navigator.locks.request(NAME, work) : work();
