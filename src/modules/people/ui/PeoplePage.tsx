'use client';
import { useTranslations } from 'next-intl';
import { EntityPage } from '@/ui/entity/EntityPage';
import { View } from '../schema/validation';
import { usePeople, usePerson, usePeopleMutations } from './queries';
import { PersonRow } from './PersonRow';
import { PersonDetail } from './PersonDetail';
import { CreatePerson } from './CreatePerson';
export function PeoplePage() {
  const t = useTranslations('common');
  const p = useTranslations('people');
  const mutations = usePeopleMutations();
  return (
    <EntityPage
      module="people"
      title={t('people')}
      description={p('directoryDescription')}
      views={View.options.map((view) => ({ id: view, label: t(view) }))}
      useList={usePeople}
      useDetail={usePerson}
      mutations={mutations}
      renderers={{
        name: (person) => person.fullName,
        row: (person) => <PersonRow person={person} />,
        detail: (person, api) => <PersonDetail person={person} api={api} />,
        create: (api) => <CreatePerson api={api} />,
      }}
    />
  );
}
