import { NotebookPen } from 'lucide-react';
import type { ClientManifest } from '@/core/modules/manifest';
import { routes } from '@/core/routes';
export const manifest: ClientManifest = {
  id: 'notes',
  nav: { href: routes.notes(), key: 'notes', icon: NotebookPen, admin: false, order: 30 },
};
