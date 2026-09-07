import 'server-only';
import type { JobHandler } from '@/core/jobs/types';
import type { ServerManifest } from './server-manifest';
import { server as tasks } from '@/modules/tasks';
import { server as people } from '@/modules/people';
import { server as users } from '@/modules/users';
import { server as settings } from '@/modules/settings';
// Home aggregates these providers; the home module itself is the consumer, so it is not listed.
export const serverModules: readonly ServerManifest[] = [tasks, people, users, settings];
export function homeProviders(modules: readonly ServerManifest[] = serverModules) {
  return modules.flatMap((item) => (item.homeSummary ? [item.homeSummary] : []));
}
export function mergeJobs(
  base: Record<string, JobHandler>,
  modules: readonly ServerManifest[] = serverModules,
) {
  const merged: Record<string, JobHandler> = { ...base };
  for (const item of modules)
    for (const [kind, handler] of Object.entries(item.jobs ?? {})) {
      if (kind in merged) throw new Error(`Job kind ${kind} is registered twice`);
      merged[kind] = handler;
    }
  return merged;
}
