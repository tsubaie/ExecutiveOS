'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Info } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import { Input } from '@/ui/primitives/input';
import { type AiReview } from '@/ui/ai/queries';
import { RefinementOutput, SuggestedTask } from '../schema/validation';
import { SuggestedTags } from './NoteRefineParts';
import type { Selection } from './NoteReview';
type Result = z.infer<typeof RefinementOutput>;
// The card: what else keeping this creates. Task rows with the title editable in place, small
// status and priority chips, and the source sentence on demand; the tags beneath. One heading,
// one master checkbox.
export function ReviewAlsoCreate({
  review,
  result,
  currentTags,
  selection,
}: {
  review: AiReview;
  result: Result;
  currentTags: string[];
  selection: Selection;
}) {
  const t = useTranslations('ai');
  const tasks = result.suggested_tasks;
  const nothing = !tasks.length && !result.suggested_tags.length;
  if (review.stale) return null;
  return (
    <section aria-label={t('alsoCreate')} className="grid gap-2">
      {/* The same label row the field has beside it, so the card and the text start level. */}
      <div className="flex min-h-8 items-center gap-3">
        {tasks.length > 0 && (
          <Checkbox
            aria-label={t('selectAllTasks')}
            checked={selection.tasks.length === tasks.length}
            indeterminate={selection.tasks.length > 0 && selection.tasks.length < tasks.length}
            disabled={selection.busy}
            onCheckedChange={(checked) =>
              selection.setTasks(checked ? tasks.map((_, index) => index) : [])
            }
          />
        )}
        <h3 className="text-sm font-medium">{t('alsoCreate')}</h3>
        {tasks.length > 0 && (
          <span className="text-sm text-text-muted tabular-nums">
            {t('tasksSelected', { count: selection.tasks.length, total: tasks.length })}
          </span>
        )}
      </div>
      <div className="grid gap-4 rounded-lg border p-4">
        {nothing && <p className="text-sm text-text-muted">{t('nothingExtra')}</p>}
        {tasks.length > 0 && (
          <ul className="divide-y">
            {tasks.map((task, index) => (
              <TaskRow key={task.title} task={task} index={index} selection={selection} />
            ))}
          </ul>
        )}
        {tasks.length > 0 && result.suggested_tags.length > 0 && (
          <div aria-hidden className="h-px bg-border" />
        )}
        <SuggestedTags
          tags={result.suggested_tags}
          currentTags={currentTags}
          selected={selection.tags}
          setSelected={selection.setTags}
          disabled={selection.busy}
        />
      </div>
    </section>
  );
}
function TaskRow({
  task,
  index,
  selection,
}: {
  task: z.infer<typeof SuggestedTask>;
  index: number;
  selection: Selection;
}) {
  const ai = useTranslations('ai');
  const [source, setSource] = useState(false);
  const on = selection.tasks.includes(index);
  return (
    <li className={cn('grid gap-2 py-3 first:pt-0 last:pb-0', !on && 'opacity-70')}>
      <div className="flex items-center gap-3">
        <Checkbox
          aria-label={ai('selectTask', { title: task.title })}
          checked={on}
          disabled={selection.busy}
          onCheckedChange={(checked) =>
            selection.setTasks(
              checked
                ? [...selection.tasks, index]
                : selection.tasks.filter((value) => value !== index),
            )
          }
        />
        <Input
          aria-label={ai('taskTitle', { number: index + 1 })}
          dir="auto"
          maxLength={120}
          disabled={selection.busy}
          value={selection.titles[index] ?? task.title}
          className="h-9 border-transparent bg-transparent px-2 hover:border-border focus-visible:border-ring dark:bg-transparent"
          onChange={(event) => selection.setTitle(index, event.target.value)}
        />
      </div>
      <TaskMeta task={task} source={source} setSource={setSource} />
      {source && task.source_snippet && (
        <p dir="auto" className="ps-7 text-sm text-text-muted">
          <q>{task.source_snippet}</q>
        </p>
      )}
    </li>
  );
}
// Status and priority as small chips, the owner and due date when the model named them, and the
// way to the source sentence.
function TaskMeta({
  task,
  source,
  setSource,
}: {
  task: z.infer<typeof SuggestedTask>;
  source: boolean;
  setSource: (open: boolean) => void;
}) {
  const words = useTranslations('tasks');
  const ai = useTranslations('ai');
  return (
    <div className="flex flex-wrap items-center gap-2 ps-7 text-xs text-text-muted">
      <span className="rounded border px-1.5 py-0.5">{words(task.status)}</span>
      {task.priority && (
        <span className="rounded border px-1.5 py-0.5">{words(task.priority)}</span>
      )}
      {task.due_date && <time dateTime={task.due_date}>{task.due_date}</time>}
      {task.owner_name && <bdi>{task.owner_name}</bdi>}
      {task.source_snippet && (
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto h-7 gap-1 px-2 text-xs"
          aria-expanded={source}
          onClick={() => setSource(!source)}
        >
          <Info className="size-3.5" aria-hidden />
          {source ? ai('hideSource') : ai('showSource')}
        </Button>
      )}
    </div>
  );
}
