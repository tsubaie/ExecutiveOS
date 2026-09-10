'use client';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { cn } from '@/ui/cn';
import { routes } from '@/core/routes';
const pages = z.enum(['users', 'settings', 'notes', 'ai', 'backups', 'jobs', 'audit']);
export function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const c = useTranslations('common');
  const path = usePathname();
  const current = pages.safeParse(path.split('/').at(-1));
  return (
    <div className="px-5 py-8 lg:px-8">
      <p className="mb-3 text-sm text-accent">{c('admin')}</p>
      <h1 className="mb-6 text-2xl font-semibold">
        {current.success ? t(current.data) : c('admin')}
      </h1>
      <nav className="mb-8 flex flex-wrap gap-1 border-b pb-3">
        {pages.options.map((page) => (
          <Link
            key={page}
            href={routes.admin(page)}
            className={cn(
              'rounded-lg px-3 py-3 text-sm text-text-muted hover:bg-surface-raised',
              current.data === page && 'bg-surface-raised text-text',
            )}
          >
            {t(page)}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
