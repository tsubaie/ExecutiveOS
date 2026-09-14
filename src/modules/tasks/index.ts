import type { ServerManifest } from '@/core/modules/server-manifest';
import { taskJobs } from './jobs';
import { homeSummary } from './service';
export { createTask, listTasks, getTask, homeSummary } from './service';
export const server: ServerManifest = { id: 'tasks', homeSummary, jobs: taskJobs };
