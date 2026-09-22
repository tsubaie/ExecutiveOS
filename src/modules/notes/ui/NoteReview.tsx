'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/button';
import { useToastManager } from '@/ui/primitives/toast';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { Markdown } from '@/ui/markdown/Markdown';
import { useUndoToast } from '@/ui/layout/toast/use-undo-toast';
import { type AiReview } from '@/ui/ai/queries';
import { RefinementOutput } from '../schema/validation';
type Result = z.infer<typeof RefinementOutput>;
export type ReviewView = 'rewrite' | 'original' | 'both';
export type Selection = ReturnType<typeof useReviewSelection>;
// NOTES-B18: what the reader keeps. The selection is reset from the proposal when review is
// entered; Keep writes the field's draft, the ticked tags and the ticked tasks with their reviewed
// titles; Discard drops the proposal and the toast offers Undo, which restores it. One selection
// feeds the header, the card and the footer, which sit in different parts of the expanded view.
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
// The header: how to look at the proposal, a word only when it can no longer be kept, and what
// changed in one line that opens when the model wrote more.
export function ReviewHeader({
  review,
  result,
  view,
  setView,
}: {
  review: AiReview;
  result: Result;
  view: ReviewView;
  setView: (view: ReviewView) => void;
}) {
  const t = useTranslations('ai');
  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewSwitch view={view} setView={setView} />
        {review.stale && (
          <p role="status" className="text-sm text-text-muted">
            {t('noteChanged')}
          </p>
        )}
      </div>
      {result.summary_of_changes && <WhatChanged summary={result.summary_of_changes} />}
    </div>
  );
}
// Rewrite, Original, or both side by side (from 1024 px): the product's segmented group.
function ViewSwitch({ view, setView }: { view: ReviewView; setView: (view: ReviewView) => void }) {
  const t = useTranslations('ai');
  const views: { id: ReviewView; label: string; wide?: boolean }[] = [
    { id: 'rewrite', label: t('viewRewrite') },
    { id: 'original', label: t('viewOriginal') },
    { id: 'both', label: t('viewSideBySide'), wide: true },
  ];
  return (
    <div role="group" aria-label={t('reviewView')} className="inline-flex rounded-lg border p-0.5">
      {views.map((item) => (
        <Button
          key={item.id}
          variant="ghost"
          size="sm"
          aria-pressed={view === item.id}
          className={cn(
            'h-8 px-3 text-sm font-normal text-text-muted pointer-coarse:h-10',
            view === item.id && 'bg-surface-raised font-medium text-text',
            item.wide && 'hidden lg:inline-flex',
          )}
          onClick={() => setView(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
// The model's account of what it changed, one line until asked for more.
function WhatChanged({ summary }: { summary: string }) {
  const t = useTranslations('ai');
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-2 text-sm text-text-muted">
      <p dir="auto" className={cn('min-w-0 flex-1', !open && 'line-clamp-1')}>
        <span className="me-1 font-medium text-text">{t('whatChanged')}</span>
        {summary}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 gap-1 px-2 text-xs"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? t('less') : t('more')}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </Button>
    </div>
  );
}
// The original, read-only, where the mode asks for it.
export function ReviewOriginal({ content }: { content: string }) {
  const t = useTranslations('ai');
  return (
    <section aria-label={t('viewOriginal')} className="grid gap-2">
      {/* The same label row the field has, so the two texts start level. */}
      <h3 className="flex min-h-8 items-center text-sm font-medium">{t('viewOriginal')}</h3>
      <div className="rounded-lg border bg-surface-raised/40 px-4 py-3">
        <Markdown content={content} />
      </div>
    </section>
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
          {count > 0 ? t('keepAndCreate', { count }) : t('keepRewrite')}
        </Button>
      )}
    </div>
  );
}
