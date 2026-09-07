import { Users } from 'lucide-react';
import type { ClientManifest } from '@/core/modules/manifest';
import { routes } from '@/core/routes';
export const manifest: ClientManifest = {
  id: 'people',
  nav: { href: routes.people(), key: 'people', icon: Users, admin: false, order: 30 },
};
