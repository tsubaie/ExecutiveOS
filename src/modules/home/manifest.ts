import { House } from 'lucide-react';
import type { ClientManifest } from '@/core/modules/manifest';
import { routes } from '@/core/routes';
export const manifest: ClientManifest = {
  id: 'home',
  nav: { href: routes.home(), key: 'home', icon: House, admin: false, order: 10 },
};
