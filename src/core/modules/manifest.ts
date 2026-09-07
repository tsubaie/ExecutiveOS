import type { LucideIcon } from 'lucide-react';
import type messages from '@/core/i18n/messages/en.json';
// Client-safe module declaration: what the shell needs to know without touching server code.
export type NavEntry = {
  href: string;
  key: keyof typeof messages.common;
  icon: LucideIcon;
  admin: boolean;
  order: number;
};
export type ClientManifest = { id: string; nav?: NavEntry };
