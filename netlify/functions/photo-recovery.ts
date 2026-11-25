import type { Config } from '@netlify/functions';
import { authenticate } from './_shared/auth';
import { getJsonStore } from './_shared/storage';
import { createPhotoRecoveryHandler } from './_shared/photo-recovery';
export default createPhotoRecoveryHandler({ authenticate, photos: getJsonStore('criativa-photo-recovery'), diagnostics: getJsonStore('criativa-photo-diagnostics') });
export const config: Config = { path: '/api/photos/recovery' };
