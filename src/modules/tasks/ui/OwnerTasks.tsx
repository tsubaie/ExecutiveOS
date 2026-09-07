'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTasks } from './queries';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { routes } from '@/core/routes';
export function OwnerTasks({ personId }: { personId: string }) {
  const t = useTranslations('tasks');
  const query = useTasks({ view: 'all', q: '', sort: '', ownerId: personId });
  return (
    <section className="mt-6 border-t pt-5">
      <h3 className="font-medium">{t('assignedTasks')}</h3>
      {query.error && <ErrorPanel error={query.error} />}
      <ul className="mt-3 grid gap-2">
        {query.items.slice(0, 5).map((task) => (
          <li key={task.id}>
            <Link
              href={routes.tasks({ view: 'all', ownerId: personId, id: task.id })}
              className="block truncate text-sm text-accent"
            >
              <bdi>{task.title}</bdi>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        className="mt-3 block text-sm text-accent"
        href={routes.tasks({ view: 'all', ownerId: personId })}
      >
        {t('viewAssigned', { count: query.counts.all ?? 0 })}
      </Link>
    </section>
  );
}
