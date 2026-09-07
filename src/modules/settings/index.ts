import type { ServerManifest } from '@/core/modules/server-manifest';
export { listSettings, updateSetting } from './service';
export const server: ServerManifest = { id: 'settings' };
