'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  ListChecks,
  Sun,
  AlertCircle,
  CalendarDays,
  Play,
  Clock,
  Inbox,
  Moon,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import type { View as ViewDef } from '@/ui/entity/types';
import { useCommitteeOptions } from '@/modules/committees/ui';
import { EntityPage } from '@/ui/entity/EntityPage';
import { sortOptions } from '@/ui/entity/filters';
import { View, Priority, Sort } from '../schema/validation';
import { useTasks, useTask, useTaskMutations, useOwners } from './queries';
import { TaskRow, TaskTrail } from './TaskRow';
const TaskDetail = dynamic(() => import('./TaskDetail').then((module) => module.TaskDetail));
import { TaskToggle } from './TaskToggle';
const CreateTask = dynamic(() => import('./CreateTask').then((module) => module.CreateTask));
import { GroupTasksDialog, canGroup } from './GroupTasks';
import { useTaskColumns } from './TaskColumns';
// Rail icons, the count strip (featured) and the archive divider per view.
const presentation: Record<string, Partial<ViewDef>> = {
  all: { icon: ListChecks },
  today: { icon: Sun, featured: true, tone: 'accent' },
  overdue: { icon: AlertCircle, featured: true, tone: 'danger' },
  upcoming: { icon: CalendarDays },
  next: { icon: Play, featured: true },
  waiting: { icon: Clock, featured: true },
  inbox: { icon: Inbox, featured: true, featuredOrder: 0 },
  someday: { icon: Moon },
  completed: { icon: CheckCircle2, separated: true },
  trash: { icon: Trash2 },
};
function useTaskFilters() {
  const committee = useCommitteeOptions();
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const owners = useOwners();
  return {
    views: View.options.map((view) => ({ id: view, label: t(view), ...presentation[view] })),
    sort: sortOptions(Sort.options, t),
    facets: [
      committee,
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
  const columns = useTaskColumns();
  const filters = useTaskFilters();
  return (
    <EntityPage
      module="tasks"
      title={c('tasks')}
      description={t('descriptionIntro')}
      filters={filters}
      emptyState={{ icon: ListChecks }}
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
        rowStyle: 'card',
        columns,
        name: (task) => task.title,
        row: (task) => <TaskRow task={task} />,
        rowTrail: (task) => <TaskTrail task={task} />,
        detail: (task, api) => <TaskDetail task={task} api={api} />,
        create: (api) => <CreateTask api={api} />,
      }}
    />
  );
}
