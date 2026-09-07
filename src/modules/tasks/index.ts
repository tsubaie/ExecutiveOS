import type { ServerManifest } from '@/core/modules/server-manifest';
import { homeSummary } from './service';
export { listTasks, getTask, homeSummary } from './service';
export const server: ServerManifest = { id: 'tasks', homeSummary };
