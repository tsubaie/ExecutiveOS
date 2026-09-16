import { searchProvider } from './search';
import { kinds, resolve } from './notifications';
import type { ServerManifest } from '@/core/modules/server-manifest';
import { taskJobs } from './jobs';
import { homeSummary } from './home';
export { createTask, listTasks, getTask } from './service';
export { homeSummary } from './home';
export const server: ServerManifest = {
  id: 'tasks',
  homeSummary,
  jobs: taskJobs,
  search: searchProvider,
  notifications: { kinds, resolve },
};
