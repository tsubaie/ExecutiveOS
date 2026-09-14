'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LoaderCircle, WandSparkles } from 'lucide-react';
import { useAiReview, type AiReview } from '@/ui/ai/queries';
import { AiOutcome, AiAvailabilityNotice, reviewReady } from '@/ui/ai/AiReviewStatus';
import { Button } from '@/ui/primitives/button';
import { type NoteDetail } from '../schema/validation';
import { RefinementOutput } from '../schema/validation';
import { NoteRefineReview } from './NoteRefineReview';
import { NoteTagAi } from './NoteTagAi';
export function NoteAi({ note, children }: { note: NoteDetail; children: ReactNode }) {
  const review = useAiReview('notes.refine', note.id, note.revision, `/notes/${note.id}/refine`);
  const [hiddenJob, setHiddenJob] = useState<string | null>(null);
  const job = review.job;
  const proposal = RefinementOutput.safeParse(job?.result?.output);
  const ready = reviewReady(review) && proposal.success;
  if (ready && proposal.success && job && hiddenJob !== job.id && !review.pending)
    return <NoteRefineReview key={job.id} review={review} result={proposal.data}
      original={job.originalContent ?? note.content} currentTags={note.tags} back={() => setHiddenJob(job.id)} />;
  return <>
    <RefineButton review={review} ready={ready} empty={!note.content.trim()} reopen={() => setHiddenJob(null)} />
    <AiOutcome review={review} />
    <AiAvailabilityNotice review={review} />
    {children}
    <NoteTagAi note={note} />
  </>;
}
function RefineButton({ review, ready, empty, reopen }: { review: AiReview; ready: boolean; empty: boolean; reopen: () => void }) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  if (!review.enabled && !ready && !review.pending) return null;
  const label = review.pending ? t('refining') : ready ? t('reviewDraft') : review.job?.status === 'failed' ? c('retry') : t('refine');
  return <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
    <Button variant="outline" aria-busy={review.pending} disabled={review.pending || empty} onClick={() => ready ? reopen() : review.start.mutate()}>
      {review.pending ? <LoaderCircle aria-hidden={true} className="size-4 animate-spin motion-reduce:animate-none" /> : <WandSparkles className="size-4" />}
      {label}
    </Button>
  </div>;
}
