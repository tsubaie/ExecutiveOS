import type { ClientManifest, NavEntry } from './manifest';
import { manifest as home } from '@/modules/home/manifest';
import { manifest as tasks } from '@/modules/tasks/manifest';
import { manifest as people } from '@/modules/people/manifest';
import { manifest as users } from '@/modules/users/manifest';
import { manifest as settings } from '@/modules/settings/manifest';
// Registering a module for the shell is one import here; nothing else in src/ui lists modules.
export const clientModules: readonly ClientManifest[] = [home, tasks, people, users, settings];
export function navigationFor(modules: readonly ClientManifest[], role: string): NavEntry[] {
  return modules
    .flatMap((item) => (item.nav ? [item.nav] : []))
    .filter((entry) => !entry.admin || role === 'admin')
    .sort((a, b) => a.order - b.order);
}
export const navigation = (role: string) => navigationFor(clientModules, role);
