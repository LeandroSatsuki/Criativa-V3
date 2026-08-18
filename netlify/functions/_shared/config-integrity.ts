export const DEFAULT_MIN_STORE_COUNT = 100;

export const resolveMinimumStoreCount = (value?: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MIN_STORE_COUNT;
};

export const hasMinimumStoreCoverage = (storeCount: number, configuredValue?: string) => (
  Number.isInteger(storeCount) &&
  storeCount >= resolveMinimumStoreCount(configuredValue)
);
