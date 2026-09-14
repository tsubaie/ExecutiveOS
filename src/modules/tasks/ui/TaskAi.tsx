'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AiPanel } from '@/ui/ai/AiPanel';
import { useAiReview, type AiReview } from '@/ui/ai/queries';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import { z } from 'zod';
import { type TaskDetail } from '../schema/validation';
import { BreakdownOutput } from '../schema/validation';
export function TaskAi({ task }: { task: TaskDetail }) {
  const t = useTranslations('ai');
  const review = useAiReview(
    'tasks.breakdown',
    task.id,
    task.revision,
    `/tasks/${task.id}/breakdown`,
  );
  const output = BreakdownOutput.safeParse(review.job?.result?.output);
  if (task.deletedAt || task.parentId || task.status === 'completed' || task.subtasks.length)
    return null;
  return (
    <AiPanel review={review} title={t('breakdown')}>
      {output.success && (
        <TaskSuggestions key={review.job?.id} review={review} output={output.data} />
      )}
    </AiPanel>
  );
}

function TaskSuggestions({
  review,
  output,
}: {
  review: AiReview;
  output: z.infer<typeof BreakdownOutput>;
}) {
  const t = useTranslations('ai');
  const [indexes, setIndexes] = useState<number[]>([]);
  return (
    <div className="space-y-3">
      {output.subtasks.map((task, index) => (
        <label key={task.title} className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={indexes.includes(index)}
            onCheckedChange={(checked) =>
              setIndexes(checked ? [...indexes, index] : indexes.filter((value) => value !== index))
            }
          />
          <span dir="auto">
            <span className="font-medium">{task.title}</span>
            {task.description && (
              <span className="mt-1 block text-text-muted">{task.description}</span>
            )}
            {task.dueDate && <bdi className="mt-1 block">{task.dueDate}</bdi>}
          </span>
        </label>
      ))}
      <Button
        disabled={review.stale || !indexes.length || review.apply.isPending}
        onClick={() => review.apply.mutate({ jobId: review.job?.id ?? '', indexes })}
      >
        {t('applySelected')}
      </Button>
      {review.stale && (
        <Button variant="outline" onClick={() => review.start.mutate()}>
          {t('regenerate')}
        </Button>
      )}
    </div>
  );
}
