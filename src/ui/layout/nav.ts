import { House, Users, Settings } from 'lucide-react';
export const navigation = [
  { href: '/home', key: 'home', icon: House, admin: false },
  { href: '/people', key: 'people', icon: Users, admin: false },
  { href: '/admin/users', key: 'admin', icon: Settings, admin: true },
];
