import { Settings } from 'lucide-react';
import type { ClientManifest } from '@/core/modules/manifest';
import { routes } from '@/core/routes';
// The administration area is entered through members; its tabs are core-owned surfaces.
export const manifest: ClientManifest = {
  id: 'users',
  nav: { href: routes.admin('users'), key: 'admin', icon: Settings, admin: true, order: 90 },
};
