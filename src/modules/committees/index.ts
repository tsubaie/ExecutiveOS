import type { ServerManifest } from '@/core/modules/server-manifest';
export { requireCommittee, getCommittee } from './service';
export const server: ServerManifest = { id: 'committees' };
