import type { ServerManifest } from '@/core/modules/server-manifest';
import { homeSummary } from './service';
export { listNotes, getNote, homeSummary } from './service';
export const server: ServerManifest = { id: 'notes', homeSummary };
