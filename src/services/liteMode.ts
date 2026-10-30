const env: Partial<ImportMetaEnv> = import.meta.env || {};
export const LITE_PREFERENCE_KEY = 'criativa_lite_enabled';
const devicePreference = () => {
  try { return localStorage.getItem(LITE_PREFERENCE_KEY) === 'true'; } catch { return false; }
};
export const litePilot = env.VITE_LITE_PILOT === 'true';
export const liteMode = litePilot || devicePreference();
export const liteTestCatalog = litePilot && env.VITE_LITE_TEST_CATALOG === 'true';
export const setLitePreference = (enabled: boolean) => localStorage.setItem(LITE_PREFERENCE_KEY, String(enabled));
let capturing = false;
export const setPhotoCaptureBusy = (busy: boolean) => { capturing = busy; };
export const isPhotoCaptureBusy = () => capturing;
