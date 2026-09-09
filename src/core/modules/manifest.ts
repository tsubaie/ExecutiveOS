import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type messages from '@/core/i18n/messages/en.json';
// Client-safe module declaration: what the shell needs to know without touching server code.
export type NavEntry = {
  href: string;
  key: keyof typeof messages.common;
  icon: LucideIcon;
  admin: boolean;
  order: number;
  // TASKS-B17: a module may trail its entry with a live figure of its own. The shell renders the
  // component and never learns what it counts or how it is fetched.
  badge?: ComponentType;
};
export type ClientManifest = { id: string; nav?: NavEntry };
