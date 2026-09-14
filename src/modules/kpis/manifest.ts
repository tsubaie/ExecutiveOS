import { Target } from 'lucide-react';
import type { ClientManifest } from '@/core/modules/manifest';
import { routes } from '@/core/routes';
export const manifest: ClientManifest = {
  id: 'kpis',
  nav: { href: routes.kpis(), key: 'kpis', icon: Target, admin: false, order: 50 },
};
