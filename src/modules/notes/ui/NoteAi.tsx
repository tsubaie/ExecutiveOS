'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LoaderCircle, WandSparkles } from 'lucide-react';
import { useAiReview, type AiReview } from '@/ui/ai/queries';
import { AiOutcome, AiAvailabilityNotice, reviewReady } from '@/ui/ai/AiReviewStatus';
import { Markdown } from '@/ui/markdown/Markdown';
import { Button } from '@/ui/primitives/button';
import type { DetailApi } from '@/ui/entity/types';
import { type NoteDetail } from '../schema/validation';
import { RefinementOutput } from '../schema/validation';
import { NoteReviewBand } from './NoteReviewBand';
import { NoteTagAi } from './NoteTagAi';
import type { ReviewSlot } from './NoteFields';
type Slots = { content: ReactNode; tags: ReactNode; review: ReviewSlot | null };
// NOTES-B22: each AI action sits on the label row of the field it changes — refine with the content
// it rewrites, tag suggestions with the tags they fill — rather than in a row above the record. It
// acts on one field, not the record, and a reader reaches for it while looking at that field; put
// at the top it also took the first read from the record's own title. The fields arrive as a render
// prop so this component keeps the review it owns while the slots land where they belong.
// NOTES-B18: a finished proposal never replaces the record. The label row's Review opens the
// expanded view (EP-B44) with the rewrite in the field itself, under a band with Keep and Discard;
// closing the view puts the note's own text back and keeps the proposal for later.
export function NoteAi({
  note,
  focus,
  children,
}: {
  note: NoteDetail;
  focus: DetailApi<object>['focus'];
  children: (slots: Slots) => ReactNode;
}) {
  const review = useAiReview('notes.refine', note.id, note.revision, `/notes/${note.id}/refine`);
  const job = review.job;
  const proposal = RefinementOutput.safeParse(job?.result?.output);
  const ready = reviewReady(review) && proposal.success && !review.pending;
  const mode = useReviewMode(focus, proposal.success ? proposal.data.refined_content : null);
  const reviewing = ready && proposal.success && job && mode.open;
  return (
    <>
      <AiOutcome review={review} />
      {children({
        content: (
          <>
            <RefineButton
              review={review}
              ready={ready}
              empty={!note.content.trim()}
              open={mode.enter}
            />
            <AiAvailabilityNotice review={review} />
          </>
        ),
        tags: <NoteTagAi note={note} />,
        review: reviewing
          ? {
              value: mode.draft,
              onCommit: mode.setDraft,
              banner: (
                <NoteReviewBand
                  key={job.id}
                  review={review}
                  result={proposal.data}
                  currentTags={note.tags}
                  draft={mode.draft}
                  original={mode.original}
                  setOriginal={mode.setOriginal}
                  onDone={mode.leave}
                />
              ),
              aside: mode.original ? (
                <OriginalNote content={job.originalContent ?? note.content} />
              ) : null,
            }
          : null,
      })}
    </>
  );
}
// Review mode lives while the expanded view is open on the content: entering it opens the view
// with the rewrite as the field's draft; the view closing, Keep or Discard all end it. The draft
// starts from the proposal each time review is entered, so an abandoned edit does not linger.
function useReviewMode(focus: DetailApi<object>['focus'], refined: string | null) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [original, setOriginal] = useState(false);
  if (open && focus.key !== 'content') setOpen(false);
  return {
    open: open && focus.key === 'content',
    draft,
    setDraft,
    original,
    setOriginal,
    enter: () => {
      setDraft(refined ?? '');
      setOriginal(false);
      setOpen(true);
      focus.set('content');
    },
    leave: () => setOpen(false),
  };
}
function OriginalNote({ content }: { content: string }) {
  const t = useTranslations('ai');
  return (
    <section aria-label={t('original')} className="grid gap-3">
      <h3 className="text-sm font-medium text-text-muted">{t('original')}</h3>
      <Markdown content={content} />
    </section>
  );
}
// Hidden rather than disabled while there is nothing to refine: a control that cannot act and does
// not say why is a dead end, and an action that does not apply yet is not information.
function RefineButton({
  review,
  ready,
  empty,
  open,
}: {
  review: AiReview;
  ready: boolean;
  empty: boolean;
  open: () => void;
}) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  if (!review.enabled && !ready && !review.pending) return null;
  if (empty && !ready && !review.pending) return null;
  const label = review.pending
    ? t('refining')
    : ready
      ? t('reviewDraft')
      : refineOrRetry(review, t('refine'), c('retry'));
  return (
    <Button
      variant={ready ? 'default' : 'outline'}
      size="sm"
      aria-busy={review.pending}
      disabled={review.pending}
      onClick={() => (ready ? open() : review.start.mutate())}
    >
      {review.pending ? (
        <LoaderCircle
          aria-hidden={true}
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <WandSparkles className="size-4" />
      )}
      {label}
    </Button>
  );
}
function refineOrRetry(review: AiReview, refine: string, retry: string) {
  return review.job?.status === 'failed' ? retry : refine;
}
