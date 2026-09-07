import type messages from '@/core/i18n/messages/en.json';
import type { LucideIcon } from 'lucide-react';
import { House, Users, Settings, ListChecks } from 'lucide-react';
export const navigation = [
  { href: '/home', key: 'home', icon: House, admin: false },
  { href: '/tasks', key: 'tasks', icon: ListChecks, admin: false },
  { href: '/people', key: 'people', icon: Users, admin: false },
  { href: '/admin/users', key: 'admin', icon: Settings, admin: true },
] satisfies { href: string; key: keyof typeof messages.common; icon: LucideIcon; admin: boolean }[];
