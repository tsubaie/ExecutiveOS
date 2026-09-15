'use client';
import { useTranslations } from 'next-intl';
import { usePlainDate, useCount } from '@/ui/format';
import { cn } from '@/ui/cn';
import type { Column } from '@/ui/entity/types';
import type { Committee } from '../schema/validation';
// EP-B29: a committee's columns are the facts its card crowds into a trailing strip — how much
// work it holds, how much of that is late, and when it last met.
function StatusCell({ committee }: { committee: Committee }) {
  const t = useTranslations('committees');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2',
        committee.status === 'archived' && 'text-text-muted',
      )}
    >
      <span
        aria-hidden={true}
        className={cn(
          'size-2 rounded-full',
          committee.status === 'active' ? 'bg-success' : 'bg-text-muted',
        )}
      />
      {t(committee.status)}
    </span>
  );
}
const Plain = ({ value }: { value: string }) => (
  <span dir="auto" className="truncate">
    {value}
  </span>
);
export function useCommitteeColumns(): Column<Committee>[] {
  const t = useTranslations('committees');
  const date = usePlainDate();
  const count = useCount();
  return [
    {
      key: 'name',
      head: t('name'),
      primary: true,
      cell: (committee) => (
        <span dir="auto" className="line-clamp-2 font-medium">
          {committee.name}
        </span>
      ),
    },
    { key: 'scope', head: t('scope'), cell: (committee) => t(committee.scope) },
    {
      key: 'ownership',
      head: t('ownership'),
      cell: (committee) => <Plain value={committee.ownership} />,
    },
    {
      key: 'tasks',
      head: t('tasks'),
      numeric: true,
      cell: ({ stats }) => `${count(stats.completed)}/${count(stats.open + stats.completed)}`,
    },
    {
      key: 'overdue',
      head: t('overdue'),
      numeric: true,
      cell: ({ stats }) =>
        stats.overdue > 0 && <span className="font-medium text-danger">{count(stats.overdue)}</span>,
    },
    {
      key: 'lastNote',
      head: t('lastNoteColumn'),
      numeric: true,
      cell: (committee) =>
        committee.lastNoteDate && (
          <time dateTime={committee.lastNoteDate} className="whitespace-nowrap">
            {date(committee.lastNoteDate)}
          </time>
        ),
    },
    { key: 'status', head: t('status'), cell: (committee) => <StatusCell committee={committee} /> },
  ];
}
