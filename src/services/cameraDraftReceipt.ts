import type { VisitState } from '../types';
import type { Attempt } from './cameraJournal';

// Weak keys let the draft own its existing arrays; monitoring never retains a photo.
const receipts = new WeakMap<string[], Attempt[]>();
export function appendCameraPhoto(previous: string[], photo: string, attempt?: Attempt) {
  const next = [...previous,photo];
  if (attempt) receipts.set(next,[...(receipts.get(previous) || []),attempt].slice(-32));
  return next;
}
export function settleCameraDraft(state: VisitState, saved: boolean) {
  const settle = (photos: Record<string,string[]> | undefined) => {
    for (const list of Object.values(photos || {})) {
      const attempts = receipts.get(list);
      if (!attempts) continue;
      receipts.delete(list);
      for (const attempt of attempts) attempt.end(saved ? 'saved' : 'write_error');
    }
  };
  settle(state.photos);
  for (const execution of Object.values(state.industryExecutions || {})) settle(execution?.photos);
}
