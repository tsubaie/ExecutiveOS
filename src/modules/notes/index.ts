import { searchProvider } from './search';
import { kinds, resolve } from './notifications';
import type { ServerManifest } from '@/core/modules/server-manifest';
import { noteJobs } from './jobs';
import { homeSummary } from './service';
export { listNotes, getNote, homeSummary } from './service';
export const server: ServerManifest = { id: 'notes', homeSummary, jobs: noteJobs, search: searchProvider, notifications: { kinds, resolve } };
