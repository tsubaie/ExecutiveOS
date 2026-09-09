import { ListChecks } from 'lucide-react';
import type { ClientManifest } from '@/core/modules/manifest';
import { routes } from '@/core/routes';
// Imported from its own file rather than through `./ui`, so the shell carries the badge alone.
import { TaskCountBadge } from './ui/TaskCountBadge';
export const manifest: ClientManifest = {
  id: 'tasks',
  nav: {
    href: routes.tasks(),
    key: 'tasks',
    icon: ListChecks,
    admin: false,
    order: 20,
    badge: TaskCountBadge,
  },
};
