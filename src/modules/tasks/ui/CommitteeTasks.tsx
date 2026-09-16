'use client';
import { useTranslations } from 'next-intl';
import { RelatedEntities } from '@/ui/entity/RelatedEntities';
import { useTasks, useTask, useTaskMutations } from './queries';
import { TaskRow, TaskTrail } from './TaskRow';
import { TaskToggle } from './TaskToggle';
import { TaskDetail } from './TaskDetail';
import { CreateTask } from './CreateTask';
export function CommitteeTasks({ committeeId, allowCreate = true }: { committeeId: string; allowCreate?: boolean }) {
  const t = useTranslations('tasks');
  const c = useTranslations('common');
  const mutations = useTaskMutations();
  return <RelatedEntities allowCreate={allowCreate} filters={{ view: 'all', q: '', sort: '', committeeId }} config={{
    module: 'tasks', title: c('tasks'), searchLabel: t('searchList'), description: t('descriptionIntro'),
    filters: { views: [{ id: 'all', label: t('all') }, { id: 'completed', label: t('completed') }] },
    group: (task) => task.band ? t(task.band) : null,
    useList: useTasks, useDetail: useTask, mutations, rowAction: (task) => <TaskToggle task={task} />,
    renderers: { row: (task) => <TaskRow task={task} />, rowTrail: (task) => <TaskTrail task={task} />, name: (task) => task.title, deletedMessage: t('deletedToast'),
      detail: (task, api) => <TaskDetail task={task} api={api} />, create: (api) => <CreateTask committeeId={committeeId} api={api} /> },
  }} />;
}
