// Share an unfinished operation. Successful and failed work both release the
// key; this is coordination only, never a cache of visit payloads or results.
export const createSingleFlight = <T>() => {
  const pending = new Map<string, Promise<T>>();
  return (key: string, work: () => Promise<T>): Promise<T> => {
    const running = pending.get(key);
    if (running) return running;
    const operation = Promise.resolve().then(work).finally(() => { pending.delete(key); });
    pending.set(key, operation);
    return operation;
  };
};
