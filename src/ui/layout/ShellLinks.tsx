'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { navigation } from './nav';
import { cn } from '@/ui/cn';
export function ShellLinks({ role }: { role: string }) {
  const t = useTranslations('common');
  const path = usePathname();
  const entries = navigation.filter((item) => !item.admin || role === 'admin');
  const links = entries.map((item) => {
    const Icon = item.icon;
    const key = item.key;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={
          path.startsWith(item.href.split('/').slice(0, 2).join('/')) ? 'page' : undefined
        }
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-text-muted hover:bg-surface-raised hover:text-text aria-[current=page]:bg-surface-raised aria-[current=page]:text-accent',
        )}
      >
        <Icon className="size-5" />
        {t(key)}
      </Link>
    );
  });
  return <>{links}</>;
}
