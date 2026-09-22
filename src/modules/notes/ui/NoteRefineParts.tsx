'use client';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import { Input } from '@/ui/primitives/input';
import { SuggestedTask } from '../schema/validation';
export function SuggestedTags({
  tags,
  currentTags,
  selected,
  setSelected,
  disabled,
}: {
  tags: string[];
  currentTags: string[];
  selected: number[];
  setSelected: (value: number[]) => void;
  disabled: boolean;
}) {
  const ai = useTranslations('ai');
  if (!tags.length) return null;
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{ai('suggestedTags')}</legend>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <Button
            key={tag}
            size="sm"
            variant="outline"
            aria-pressed={selected.includes(index)}
            className={cn(
              'h-auto min-h-9 gap-2 rounded-full px-3 py-2',
              selected.includes(index)
                ? 'border-accent bg-accent/15 font-semibold text-accent ring-2 ring-accent/50 hover:bg-accent/25 hover:text-accent dark:border-accent dark:bg-accent/15 dark:hover:bg-accent/25'
                : 'border-border bg-surface text-text-muted hover:bg-surface-raised dark:border-border dark:bg-surface dark:hover:bg-surface-raised',
            )}
            onClick={() =>
              setSelected(
                selected.includes(index)
                  ? selected.filter((value) => value !== index)
                  : [...selected, index],
              )
            }
          >
            {selected.includes(index) ? (
              <Check aria-hidden={true} className="size-4" />
            ) : (
              <Plus aria-hidden={true} className="size-4" />
            )}
            <bdi>{tag}</bdi>
            {currentTags.some((current) => current.toLowerCase() === tag.toLowerCase()) && (
              <span className="text-text-muted">{ai('existingTag')}</span>
            )}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
export function RefineTasks({
  tasks,
  selected,
  setSelected,
  titles,
  setTitle,
  disabled,
}: {
  tasks: z.infer<typeof SuggestedTask>[];
  selected: number[];
  setSelected: (value: number[]) => void;
  titles: string[];
  setTitle: (index: number, title: string) => void;
  disabled: boolean;
}) {
  const ai = useTranslations('ai');
  if (!tasks.length)
    return <p className="py-8 text-center text-sm text-text-muted">{ai('noTasksFound')}</p>;
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <TasksHeader total={tasks.length} selected={selected} setSelected={setSelected} />
      {tasks.map((task, index) => (
        <div key={task.title} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <Checkbox
              aria-label={ai('selectTask', { title: task.title })}
              checked={selected.includes(index)}
              onCheckedChange={(checked) =>
                setSelected(
                  checked ? [...selected, index] : selected.filter((value) => value !== index),
                )
              }
            />
            <Input
              aria-label={ai('taskTitle', { number: index + 1 })}
              dir="auto"
              maxLength={120}
              value={titles[index] ?? task.title}
              onChange={(event) => setTitle(index, event.target.value)}
            />
          </div>
          <TaskContext task={task} />
        </div>
      ))}
    </fieldset>
  );
}
function TaskContext({ task }: { task: z.infer<typeof SuggestedTask> }) {
  const t = useTranslations('tasks');
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2 text-xs text-text-muted">
        <span className="rounded border px-2 py-1">{t(task.status)}</span>
        {task.priority && <span className="rounded border px-2 py-1">{t(task.priority)}</span>}
        {task.due_date && <time dateTime={task.due_date}>{task.due_date}</time>}
        {task.owner_name && <bdi>{task.owner_name}</bdi>}
      </div>
      {task.description && <p dir="auto">{task.description}</p>}
      {task.source_snippet && (
        <blockquote dir="auto" className="border-s-2 ps-3 text-text-muted">
          {task.source_snippet}
        </blockquote>
      )}
    </div>
  );
}
function TasksHeader({
  total,
  selected,
  setSelected,
}: {
  total: number;
  selected: number[];
  setSelected: (value: number[]) => void;
}) {
  const ai = useTranslations('ai');
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="grid gap-0.5">
        <h4 className="text-sm font-medium">{ai('suggestedTasksCount', { count: total })}</h4>
        <p className="text-xs text-text-muted tabular-nums">
          {ai('tasksSelected', { count: selected.length, total: total })}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          setSelected(
            selected.length === total ? [] : Array.from({ length: total }, (_, index) => index),
          )
        }
      >
        {selected.length === total ? ai('deselectAll') : ai('selectAll')}
      </Button>
    </div>
  );
}
