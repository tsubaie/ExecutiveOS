import { Landmark } from 'lucide-react';
import type { ClientManifest } from '@/core/modules/manifest';
import { routes } from '@/core/routes';
export const manifest: ClientManifest = { id: 'committees', nav: {
  href: routes.committees(), key: 'committees', icon: Landmark, admin: false, order: 40,
} };
