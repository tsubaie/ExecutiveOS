import { ListChecks } from 'lucide-react';
import type { ClientManifest } from '@/core/modules/manifest';
import { routes } from '@/core/routes';
export const manifest: ClientManifest = {
  id: 'tasks',
  nav: { href: routes.tasks(), key: 'tasks', icon: ListChecks, admin: false, order: 20 },
};
