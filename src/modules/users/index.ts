import type { ServerManifest } from '@/core/modules/server-manifest';
export { setup, listUsers, patchUser } from './service';
export const server: ServerManifest = { id: 'users' };
