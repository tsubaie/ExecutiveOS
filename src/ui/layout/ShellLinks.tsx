'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { navigation } from '@/core/modules/client';
import { cn } from '@/ui/cn';
type Scope = 'all' | 'primary' | 'admin';
// ADMIN-B19: the shell renders the same entries in three places. `scope` picks which of them:
// the sidebar carries the everyday modules at the top and the administration entry at its foot,
// while the mobile bar carries every entry it is given.
export function ShellLinks({ role, scope = 'all' }: { role: string; scope?: Scope }) {
  const t = useTranslations('common');
  const path = usePathname();
  const links = navigation(role)
    .filter((item) => scope === 'all' || item.admin === (scope === 'admin'))
    .map((item) => {
      const Icon = item.icon;
      const Badge = item.badge;
      const key = item.key;
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            path.startsWith(item.href.split('/').slice(0, 2).join('/')) ? 'page' : undefined
          }
          className={cn(
            'group/nav flex min-h-11 items-center gap-3 rounded-lg px-3 text-text-muted hover:bg-surface-raised hover:text-text aria-[current=page]:bg-surface-raised aria-[current=page]:text-accent',
          )}
        >
          <Icon className="size-5" />
          {/* The mobile bar lays each entry out as a column (tokens.css), where a growing label
              would stretch instead of sitting beside the icon; only the rail needs it to grow. */}
          <span className={cn('min-w-0 truncate', scope !== 'all' && 'flex-1')}>{t(key)}</span>
          {Badge && scope !== 'all' && <Badge />}
        </Link>
      );
    });
  return <>{links}</>;
}
