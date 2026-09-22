'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Sparkles } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { Markdown } from '@/ui/markdown/Markdown';
import { useUndoToast } from '@/ui/layout/toast/use-undo-toast';
import { useToastManager } from '@/ui/primitives/toast';
import { type AiReview } from '@/ui/ai/queries';
import { RefinementOutput } from '../schema/validation';
import { SuggestedTags, RefineTasks } from './NoteRefineParts';
type Result = z.infer<typeof RefinementOutput>;
export type Selection = ReturnType<typeof useReviewSelection>;
// NOTES-B18: what the reader keeps. The selection is reset from the proposal when review is
// entered; Keep writes the field's draft, the ticked tags and the ticked tasks with their reviewed
// titles; Discard drops the proposal and the toast offers Undo, which restores it. One selection
// feeds the band, the rail and the footer, which sit in different parts of the expanded view.
type Picked = { tasks: number[]; tags: number[]; titles: string[] };
export function useReviewSelection(review: AiReview, onDone: () => void) {
  const t = useTranslations('ai');
  const toast = useUndoToast();
  const toasts = useToastManager();
  const [picked, setPicked] = useState<Picked>({ tasks: [], tags: [], titles: [] });
  const busy = review.apply.isPending || review.discard.isPending || review.pending;
  const jobId = review.job?.id ?? '';
  const keep = (result: Result, draft: string) =>
    review.apply.mutate(
      {
        jobId,
        acceptContent: true,
        ...(draft !== result.refined_content ? { content: draft } : {}),
        taskIndexes: picked.tasks,
        tagIndexes: picked.tags,
        taskTitles: picked.tasks.map((index) => ({ index, title: picked.titles[index] ?? '' })),
      },
      {
        onSuccess: () => {
          onDone();
          toasts.add({ title: t('kept') });
        },
      },
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
    ...picked,
    busy,
    invalidTitles: picked.tasks.some((index) => !picked.titles[index]?.trim()),
    keep,
    discard,
    reset: (result: Result) =>
      setPicked({
        tasks: result.suggested_tasks.map((_, index) => index),
        tags: result.suggested_tags.map((_, index) => index),
        titles: result.suggested_tasks.map((task) => task.title),
      }),
    setTasks: (tasks: number[]) => setPicked((current) => ({ ...current, tasks })),
    setTags: (tags: number[]) => setPicked((current) => ({ ...current, tags })),
    setTitle: (index: number, title: string) =>
      setPicked((current) => ({
        ...current,
        titles: current.titles.map((value, position) => (position === index ? title : value)),
      })),
  };
}
// The band: a line that says what the text beneath is, and the model's own account of what it
// changed. Nothing to press here; the decisions live in the footer.
export function ReviewBand({ review, result }: { review: AiReview; result: Result }) {
  const t = useTranslations('ai');
  return (
    <section
      aria-label={t('suggestedRewrite')}
      className={cn(
        'mb-4 grid gap-1 border-s-4 ps-4',
        review.stale ? 'border-border' : 'border-accent',
      )}
    >
      <h3 className="flex items-center gap-2 font-medium">
        <Sparkles className="size-4 text-accent" aria-hidden />
        {t('suggestedRewrite')}
      </h3>
      <p dir="auto" className="line-clamp-2 text-sm text-text-muted sm:line-clamp-none">
        {review.stale ? t('staleHint') : result.summary_of_changes || t('reviewHint')}
      </p>
    </section>
  );
}
// The rail: what comes with the rewrite, ticked or not, and the original under a disclosure.
export function ReviewRail({
  review,
  result,
  currentTags,
  original,
  selection,
}: {
  review: AiReview;
  result: Result;
  currentTags: string[];
  original: string;
  selection: Selection;
}) {
  const t = useTranslations('ai');
  return (
    <aside aria-label={t('suggestions')} className="grid content-start gap-6 lg:sticky lg:top-0">
      {!review.stale && !result.suggested_tags.length && !result.suggested_tasks.length && (
        <p className="text-sm text-text-muted">{t('nothingExtra')}</p>
      )}
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
      <details className="group rounded-lg border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{t('original')}</summary>
        <div className="border-t px-3 py-3 text-sm">
          <Markdown content={original} />
        </div>
      </details>
    </aside>
  );
}
// The footer: Discard at the start, the one decision at the end, its name saying what it does.
export function ReviewActions({
  review,
  result,
  draft,
  selection,
}: {
  review: AiReview;
  result: Result;
  draft: string;
  selection: Selection;
}) {
  const t = useTranslations('ai');
  const count = selection.tasks.length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        className="pointer-coarse:h-11"
        disabled={selection.busy}
        onClick={selection.discard}
      >
        {t('discardRewrite')}
      </Button>
      {selection.busy && (
        <p role="status" className="text-sm text-text-muted">
          {review.apply.isPending ? t('applying') : t('working')}
        </p>
      )}
      {review.error && <ErrorPanel error={review.error} />}
      <span className="ms-auto" />
      {review.stale ? (
        review.enabled && (
          <Button
            variant="outline"
            className="pointer-coarse:h-11"
            disabled={selection.busy}
            onClick={() => review.start.mutate()}
          >
            {t('regenerate')}
          </Button>
        )
      ) : (
        <Button
          className="tabular-nums pointer-coarse:h-11"
          disabled={selection.busy || (count > 0 && selection.invalidTitles)}
          onClick={() => selection.keep(result, draft)}
        >
          {count > 0 ? t('keepWithTasks', { count }) : t('keepRewrite')}
        </Button>
      )}
    </div>
  );
}
