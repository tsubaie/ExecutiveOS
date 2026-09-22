'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Sparkles } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useUndoToast } from '@/ui/layout/toast/use-undo-toast';
import { type AiReview } from '@/ui/ai/queries';
import { RefinementOutput } from '../schema/validation';
import { SuggestedTags, RefineTasks } from './NoteRefineParts';
type Result = z.infer<typeof RefinementOutput>;
type Props = {
  review: AiReview;
  result: Result;
  currentTags: string[];
  // The rewrite as the reader has edited it in the field beneath the band.
  draft: string;
  original: boolean;
  setOriginal: (show: boolean) => void;
  onDone: () => void;
};
// NOTES-B18: the proposal under review sits above the text it proposes, in the expanded view. One
// band says what this is and what changed; Keep writes what the field shows, Discard drops the
// proposal and offers Undo for a moment; the tasks and tags it suggests are ticked beneath.
export function NoteReviewBand({
  review,
  result,
  currentTags,
  draft,
  original,
  setOriginal,
  onDone,
}: Props) {
  const t = useTranslations('ai');
  const selection = useSelection(review, result, draft, onDone);
  return (
    <section
      aria-label={t('suggestedRewrite')}
      className={cn(
        'mb-4 grid gap-3 rounded-lg border-s-4 bg-surface-raised px-4 py-3',
        review.stale ? 'border-border' : 'border-accent',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <h3 className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4 text-accent" aria-hidden />
            {t('suggestedRewrite')}
          </h3>
          <p dir="auto" className="text-sm text-text-muted">
            {review.stale ? t('staleHint') : result.summary_of_changes || t('reviewHint')}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOriginal(!original)}>
          {original ? t('hideOriginal') : t('showOriginal')}
        </Button>
      </div>
      {!review.stale && (
        <>
          <SuggestedTags
            tags={result.suggested_tags}
            currentTags={currentTags}
            selected={selection.tags}
            setSelected={selection.setTags}
            disabled={selection.busy}
          />
          <RefineTasks
            tasks={result.suggested_tasks}
            selected={selection.tasks}
            setSelected={selection.setTasks}
            titles={selection.titles}
            setTitle={selection.setTitle}
            disabled={selection.busy}
          />
        </>
      )}
      {review.error && <ErrorPanel error={review.error} />}
      <BandActions review={review} selection={selection} />
    </section>
  );
}
function useSelection(review: AiReview, result: Result, draft: string, onDone: () => void) {
  const t = useTranslations('ai');
  const toast = useUndoToast();
  const [tasks, setTasks] = useState(result.suggested_tasks.map((_, index) => index));
  const [tags, setTags] = useState(result.suggested_tags.map((_, index) => index));
  const [titles, setTitles] = useState(result.suggested_tasks.map((task) => task.title));
  const busy = review.apply.isPending || review.discard.isPending || review.pending;
  const invalidTitles = tasks.some((index) => !titles[index]?.trim());
  const jobId = review.job?.id ?? '';
  const keep = (includeTasks: boolean) =>
    review.apply.mutate(
      {
        jobId,
        acceptContent: true,
        ...(draft !== result.refined_content ? { content: draft } : {}),
        taskIndexes: includeTasks ? tasks : [],
        tagIndexes: tags,
        taskTitles: includeTasks
          ? tasks.map((index) => ({ index, title: titles[index] ?? '' }))
          : [],
      },
      { onSuccess: onDone },
    );
  const discard = () =>
    review.discard.mutate(undefined, {
      onSuccess: () => {
        onDone();
        toast({
          message: t('discarded'),
          undo: () => review.restore.mutateAsync(jobId).then(() => undefined),
        });
      },
    });
  return {
    tasks,
    setTasks,
    tags,
    setTags,
    titles,
    busy,
    invalidTitles,
    keep,
    discard,
    setTitle: (index: number, title: string) =>
      setTitles((values) => values.map((value, position) => (position === index ? title : value))),
  };
}
function BandActions({
  review,
  selection,
}: {
  review: AiReview;
  selection: ReturnType<typeof useSelection>;
}) {
  const t = useTranslations('ai');
  const withTasks = selection.tasks.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selection.busy && (
        <p role="status" className="me-auto text-sm text-text-muted">
          {review.apply.isPending ? t('applying') : t('working')}
        </p>
      )}
      {review.stale ? (
        review.enabled && (
          <Button variant="outline" disabled={selection.busy} onClick={() => review.start.mutate()}>
            {t('regenerate')}
          </Button>
        )
      ) : (
        <Button
          disabled={selection.busy || (withTasks && selection.invalidTitles)}
          onClick={() => selection.keep(withTasks)}
        >
          {withTasks ? t('keepWithTasks', { count: selection.tasks.length }) : t('keep')}
        </Button>
      )}
      {!review.stale && withTasks && (
        <Button variant="outline" disabled={selection.busy} onClick={() => selection.keep(false)}>
          {t('keepWithoutTasks')}
        </Button>
      )}
      <Button variant="ghost" disabled={selection.busy} onClick={selection.discard}>
        {t('discard')}
      </Button>
    </div>
  );
}
