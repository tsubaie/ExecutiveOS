'use client';
import { useTranslations } from 'next-intl';
import { initials } from '@/ui/format';
import type { Column } from '@/ui/entity/types';
import type { Person } from '../schema/validation';
// EP-B29: a directory reads as a table more naturally than as cards, which is most of why the
// choice exists. The initials chip stays beside the name: it is how a reader recognises a row
// they have seen before, and it costs a column nothing.
export function usePersonColumns(): Column<Person>[] {
  const t = useTranslations('common');
  const p = useTranslations('people');
  return [
    {
      key: 'name',
      head: p('fullName'),
      primary: true,
      cell: (person) => (
        <span className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-surface-raised text-xs font-medium text-accent">
            <bdi>{initials(person.fullName)}</bdi>
          </span>
          <span dir="auto" className="truncate font-medium">
            {person.fullName}
          </span>
        </span>
      ),
    },
    {
      key: 'organization',
      head: p('organization'),
      cell: (person) => (
        <span dir="auto" className="truncate">
          {person.organization}
        </span>
      ),
    },
    {
      key: 'role',
      head: p('roleTitle'),
      cell: (person) => (
        <span dir="auto" className="truncate">
          {person.roleTitle}
        </span>
      ),
    },
    { key: 'kind', head: p('kind'), cell: (person) => t(person.kind) },
  ];
}
