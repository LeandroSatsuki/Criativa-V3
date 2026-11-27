// Ask the browser to flush critical evidence before reporting a successful save.
// Older engines may reject the options argument. Never retry real storage errors.
export const evidenceTransaction = (database: IDBDatabase, stores: string | string[]) => {
  try {
    return database.transaction(stores, 'readwrite', { durability: 'strict' });
  } catch (error) {
    if (!(error instanceof TypeError) && (error as DOMException)?.name !== 'NotSupportedError') throw error;
    return database.transaction(stores, 'readwrite');
  }
};
