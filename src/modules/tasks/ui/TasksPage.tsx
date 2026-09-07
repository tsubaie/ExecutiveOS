'use client';
import { useTranslations } from 'next-intl';
import { EntityPage } from '@/ui/entity/EntityPage';
import { View, Priority, Sort } from '../schema/validation';
import { useTasks, useTask, useTaskMutations, useOwners } from './queries';
import { TaskRow } from './TaskRow';
import { TaskDetail } from './TaskDetail';
import { TaskToggle } from './TaskToggle';
import { CreateTask } from './CreateTask';
import { GroupTasksDialog, canGroup } from './GroupTasks';
function useTaskFilters() {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const owners = useOwners();
  return {
    views: View.options.map((view) => ({ id: view, label: t(view) })),
    sort: {
      default: '',
      options: Sort.options.map((value) => ({
        id: value === 'default' ? '' : value,
        label: t(value),
      })),
    },
    facets: [
      {
        key: 'ownerId',
        label: t('owner'),
        options: [
          { value: '', label: c('all') },
          ...(owners.data?.data ?? []).map((person) => ({
            value: person.id,
            label: person.displayName ?? person.fullName,
          })),
        ],
      },
      {
        key: 'priority',
        label: t('priority'),
        options: [
          { value: '', label: c('all') },
          ...Priority.options.map((value) => ({ value, label: t(value) })),
        ],
      },
    ],
  };
}
export function TasksPage() {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  const filters = useTaskFilters();
  return (
    <EntityPage
      module="tasks"
      title={c('tasks')}
      description={t('descriptionIntro')}
      filters={filters}
      useList={useTasks}
      useDetail={useTask}
      mutations={mutations}
      group={(task) => (task.deletedAt || !task.band ? null : t(task.band))}
      rowAction={(task) => <TaskToggle task={task} />}
      bulkActions={[
        {
          id: 'group',
          label: t('group'),
          enabled: canGroup,
          render: (items, finish) => <GroupTasksDialog items={items} finish={finish} />,
        },
      ]}
      renderers={{
        name: (task) => task.title,
        row: (task) => <TaskRow task={task} />,
        detail: (task, api) => <TaskDetail task={task} api={api} />,
        create: (api) => <CreateTask api={api} />,
      }}
    />
  );
}
