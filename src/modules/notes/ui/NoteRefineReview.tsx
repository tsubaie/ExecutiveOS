'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs } from '@base-ui/react/tabs';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { type AiReview } from '@/ui/ai/queries';
import { RefinementOutput } from '../schema/validation';
import { SuggestedTags, RefinedNote, RefineTasks } from './NoteRefineParts';
type Result = z.infer<typeof RefinementOutput>;
export function NoteRefineReview({ review, result, original, currentTags, back }: {
  review: AiReview; result: Result; original: string; currentTags: string[]; back: () => void;
}) {
  const t = useTranslations('ai');
  const selection = useSelection(review, result);
  return <section aria-label={t('refinementReview')} className="space-y-4 rounded-xl border border-accent p-4"
    onKeyDownCapture={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); if (!selection.busy) back(); }
    }}>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" onClick={back} disabled={selection.busy}><ArrowLeft className="size-4 rtl:rotate-180" />{t('backToNote')}</Button>
      <h2 className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-accent" />{t('refinementReview')}</h2>
    </div>
    {review.stale && <p role="alert" className="text-sm text-danger">{t('stale')}</p>}
    {!!review.job?.result?.warnings.length && <p className="text-sm text-text-muted">{t('warnings', { count: review.job.result.warnings.length })}</p>}
    <SuggestedTags tags={result.suggested_tags} currentTags={currentTags} selected={selection.tags} setSelected={selection.setTags} disabled={selection.busy} />
    <Tabs.Root defaultValue="note">
      <Tabs.List aria-label={t('refinementReview')} className="mb-4 flex gap-2 border-b">
        <Tabs.Tab value="note" className="border-b-2 border-transparent px-3 py-2 text-sm data-active:border-accent data-active:text-accent">{t('refinedNote')}</Tabs.Tab>
        <Tabs.Tab value="tasks" className="border-b-2 border-transparent px-3 py-2 text-sm data-active:border-accent data-active:text-accent">{t('suggestedTasksCount', { count: result.suggested_tasks.length })}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="note"><RefinedNote content={result.refined_content} original={original} summary={result.summary_of_changes} /></Tabs.Panel>
      <Tabs.Panel value="tasks"><RefineTasks tasks={result.suggested_tasks} selected={selection.tasks} setSelected={selection.setTasks} titles={selection.titles} setTitle={selection.setTitle} disabled={selection.busy} /></Tabs.Panel>
    </Tabs.Root>
    {review.error && <ErrorPanel error={review.error} />}
    <ReviewActions review={review} selection={selection} />
  </section>;
}
function useSelection(review: AiReview, result: Result) {
  const [tasks, setTasks] = useState(result.suggested_tasks.map((_, index) => index));
  const [tags, setTags] = useState(result.suggested_tags.map((_, index) => index));
  const [titles, setTitles] = useState(result.suggested_tasks.map((task) => task.title));
  const busy = review.apply.isPending || review.discard.isPending || review.pending;
  const invalidTitles = tasks.some((index) => !titles[index]?.trim());
  function apply(includeTasks: boolean) {
    review.apply.mutate({ jobId: review.job?.id ?? '', acceptContent: true,
      taskIndexes: includeTasks ? tasks : [], tagIndexes: tags,
      taskTitles: includeTasks ? tasks.map((index) => ({ index, title: titles[index] ?? '' })) : [],
    });
  }
  return { tasks, setTasks, tags, setTags, titles, busy, invalidTitles, apply,
    setTitle: (index: number, title: string) => setTitles((values) => values.map((value, position) => position === index ? title : value)),
  };
}
function ReviewActions({ review, selection }: { review: AiReview; selection: ReturnType<typeof useSelection> }) {
  const t = useTranslations('ai');
  return <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
    {selection.busy && <p role="status" className="text-sm text-text-muted">{review.apply.isPending ? t('applying') : t('working')}</p>}
    <Button variant="ghost" disabled={selection.busy} onClick={() => review.discard.mutate()}>{t('discard')}</Button>
    {review.stale && review.enabled && <Button variant="outline" disabled={selection.busy} onClick={() => review.start.mutate()}>{t('regenerate')}</Button>}
    <Button variant="outline" disabled={selection.busy || review.stale} onClick={() => selection.apply(false)}>{t('applyNoteOnly')}</Button>
    {selection.tasks.length > 0 && <Button disabled={selection.busy || review.stale || selection.invalidTitles} onClick={() => selection.apply(true)}>{t('applyNoteTasks', { count: selection.tasks.length })}</Button>}
  </div>;
}
