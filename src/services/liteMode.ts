// Build-time gate: production keeps the current behavior until the pilot is approved.
export const liteMode = import.meta.env.VITE_LITE_PILOT === 'true';
