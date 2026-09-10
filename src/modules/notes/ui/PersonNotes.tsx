'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { routes } from '@/core/routes';
import { useNotes } from './queries';
// NOTES-B15: the latest five notes a person took part in, and a link to the filtered list.
export function PersonNotes({ personId }: { personId: string }) {
  const t = useTranslations('notes');
  const list = useNotes({ view: 'all', q: '', sort: '', personId });
  return (
    <section className="mt-6 border-t pt-5">
      <h3 className="font-medium">{t('personNotes')}</h3>
      {list.error && <ErrorPanel error={list.error} />}
      <ul className="mt-3 grid gap-2">
        {list.items.slice(0, 5).map((note) => (
          <li key={note.id}>
            <Link
              href={routes.notes({ view: 'all', personId, id: note.id })}
              className="block truncate text-sm text-accent"
            >
              <bdi>{note.title}</bdi>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        className="mt-3 block text-sm text-accent"
        href={routes.notes({ view: 'all', personId })}
      >
        {t('viewNotes', { count: list.counts.all ?? 0 })}
      </Link>
    </section>
  );
}
