import 'server-only';
import type { JobHandler } from '@/core/jobs/types';
import type { Context } from '@/core/auth/session';
import type { HomeSection, ServerManifest } from './server-manifest';
import { server as tasks } from '@/modules/tasks';
import { server as people } from '@/modules/people';
import { server as notes } from '@/modules/notes';
import { server as users } from '@/modules/users';
import { server as settings } from '@/modules/settings';
// Home aggregates these providers; the home module itself is the consumer, so it is not listed.
export const serverModules: readonly ServerManifest[] = [tasks, notes, people, users, settings];
export function homeProviders(modules: readonly ServerManifest[] = serverModules) {
  return modules.flatMap((item) => (item.homeSummary ? [item.homeSummary] : []));
}
// HOME-B06: section ownership is checked the way job kinds are (ADMIN-B15). Picking the first
// match instead would make the page depend on module import order and hide a section silently.
export async function collectHomeSections(
  ctx: Context,
  keys: readonly string[],
  modules: readonly ServerManifest[] = serverModules,
) {
  const owned = new Map<string, HomeSection>();
  for (const provide of homeProviders(modules))
    for (const section of await provide(ctx)) {
      if (!keys.includes(section.key))
        throw new Error(`Home section ${section.key} is not a known section`);
      if (owned.has(section.key)) throw new Error(`Home section ${section.key} is provided twice`);
      owned.set(section.key, section);
    }
  return owned;
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
