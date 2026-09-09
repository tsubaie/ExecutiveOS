// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { House, ListChecks, Settings } from 'lucide-react';
import en from '@/core/i18n/messages/en.json';
import { ShellLinks } from '@/ui/layout/ShellLinks';
import { navigationFor } from '../client';
import type { ClientManifest } from '../manifest';
const badgeText = '7';
const modules: ClientManifest[] = [
  { id: 'home', nav: { href: '/home', key: 'home', icon: House, admin: false, order: 10 } },
  {
    id: 'tasks',
    nav: {
      href: '/tasks',
      key: 'tasks',
      icon: ListChecks,
      admin: false,
      order: 20,
      badge: () => <span>{badgeText}</span>,
    },
  },
  {
    id: 'users',
    nav: { href: '/admin/users', key: 'admin', icon: Settings, admin: true, order: 90 },
  },
];
vi.mock('next/navigation', () => ({ usePathname: () => '/tasks' }));
vi.mock('@/core/modules/client', async (original) => {
  const actual = await original<typeof import('../client')>();
  return { ...actual, navigation: (role: string) => actual.navigationFor(modules, role) };
});
function mount(scope: 'all' | 'primary' | 'admin', role = 'admin') {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={en}
      formats={{ number: { integer: { maximumFractionDigits: 0 } } }}
    >
      <ShellLinks role={role} scope={scope} />
    </NextIntlClientProvider>,
  );
}
const names = () => screen.getAllByRole('link').map((link) => link.textContent);
describe('shell navigation', () => {
  afterEach(cleanup);
  it('ADMIN-B19 the sidebar carries administration apart from the everyday modules', () => {
    mount('primary');
    expect(names()).toEqual([en.common.home, en.common.tasks + badgeText]);
    cleanup();
    mount('admin');
    expect(names()).toEqual([en.common.admin]);
  });
  it('ADMIN-B19 the mobile bar keeps every entry in one list', () => {
    mount('all');
    expect(names()).toEqual([en.common.home, en.common.tasks, en.common.admin]);
  });
  it('ADMIN-B03 ADMIN-B19 a member never sees the administration entry in either place', () => {
    mount('admin', 'member');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    cleanup();
    mount('all', 'member');
    expect(names()).toEqual([en.common.home, en.common.tasks]);
  });
  it('EP-A01 navigation still comes from the manifests, sorted by order', () => {
    expect(navigationFor(modules, 'admin').map((entry) => entry.href)).toEqual([
      '/home',
      '/tasks',
      '/admin/users',
    ]);
  });
});
