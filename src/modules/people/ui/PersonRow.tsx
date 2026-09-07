'use client';
import { useTranslations } from 'next-intl';
import type { Person } from '../schema/validation';
import { initials } from '@/ui/format';
export function PersonRow({ person }: { person: Person }) {
  const t = useTranslations('common');
  const p = useTranslations('people');
  return (
    <span className="flex w-full min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-surface-raised text-sm font-medium text-accent">
        <bdi>{initials(person.fullName)}</bdi>
      </span>
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate font-medium">
          {person.fullName}
        </span>
        <span dir="auto" className="mt-1 block truncate text-xs text-text-muted">
          {[person.organization, person.roleTitle].filter(Boolean).join(' · ') ||
            p('noOrganization')}
        </span>
      </span>
      <span className="rounded-md border px-2 py-1 text-xs text-text-muted">{t(person.kind)}</span>
    </span>
  );
}
