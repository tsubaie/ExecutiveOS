'use client';
import { useTranslations } from 'next-intl';
import { Trash2, RotateCcw } from 'lucide-react';
import type { Person } from '../schema/validation';
import type { DetailApi } from '@/ui/entity/types';
import { Button } from '@/ui/primitives/button';
import { PersonForm, type Patch } from './PersonForm';
import { OwnerTasks } from '@/modules/tasks/ui';
import { PersonNotes } from '@/modules/notes/ui';
import { initials } from '@/ui/format';
export function PersonDetail({ person, api }: { person: Person; api: DetailApi<Patch> }) {
  const t = useTranslations('people');
  const c = useTranslations('common');
  return (
    <div>
      <div className="mb-7 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg text-accent">
          <bdi>{initials(person.fullName)}</bdi>
        </span>
        <div className="min-w-0">
          <h2 tabIndex={-1} dir="auto" className="text-xl font-semibold">
            {person.fullName}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t('details')}</p>
        </div>
      </div>
      {person.deletedAt ? (
        <div className="grid gap-4">
          <p>{t('deleted')}</p>
          <Button onClick={api.restore}>
            <RotateCcw className="size-4" />
            {c('restore')}
          </Button>
        </div>
      ) : (
        <>
          <PersonForm initial={person} save={api.save} />
          <OwnerTasks personId={person.id} />
          <PersonNotes personId={person.id} />
          <div className="mt-8 border-t pt-5">
            <Button variant="destructive" onClick={api.remove}>
              <Trash2 className="size-4" />
              {c('delete')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
