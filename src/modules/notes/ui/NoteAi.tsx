'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { z } from 'zod';
import { LoaderCircle, WandSparkles } from 'lucide-react';
import { useAiReview, type AiReview } from '@/ui/ai/queries';
import { AiOutcome, AiAvailabilityNotice, reviewReady } from '@/ui/ai/AiReviewStatus';
import { Button } from '@/ui/primitives/button';
import type { DetailApi } from '@/ui/entity/types';
import { type NoteDetail } from '../schema/validation';
import { RefinementOutput } from '../schema/validation';
import { ReviewActions, ReviewBand, ReviewRail, useReviewSelection } from './NoteReviewBand';
import { NoteTagAi } from './NoteTagAi';
import type { ReviewSlot } from './NoteFields';
type Slots = { content: ReactNode; tags: ReactNode; review: ReviewSlot | null };
type Result = z.infer<typeof RefinementOutput>;
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
  const t = useTranslations('ai');
  const review = useAiReview('notes.refine', note.id, note.revision, `/notes/${note.id}/refine`);
  const job = review.job;
  const proposal = RefinementOutput.safeParse(job?.result?.output);
  const ready = reviewReady(review) && proposal.success && !review.pending;
  const mode = useReviewMode(focus, proposal.success ? proposal.data : null);
  const selection = useReviewSelection(review, mode.leave);
  const reviewing = ready && proposal.success && job && mode.open;
  return (
    <>
      <AiOutcome review={review} />
      {children({
        // While the rewrite is under review the way in has been taken; the row keeps only the notice.
        content: (
          <>
            {!reviewing && (
              <RefineButton
                review={review}
                ready={ready}
                empty={!note.content.trim()}
                open={() => {
                  if (proposal.success) selection.reset(proposal.data);
                  mode.enter();
                }}
              />
            )}
            <AiAvailabilityNotice review={review} />
          </>
        ),
        tags: <NoteTagAi note={note} />,
        review: reviewing
          ? reviewSlots({
              review,
              result: proposal.data,
              note,
              original: job.originalContent ?? note.content,
              draft: mode.draft,
              setDraft: mode.setDraft,
              selection,
              asideTitle: t('suggestionsCount', {
                tags: proposal.data.suggested_tags.length,
                tasks: proposal.data.suggested_tasks.length,
              }),
            })
          : null,
      })}
    </>
  );
}
// What the fields get while a proposal is under review: the rewrite as the content's draft, the
// band above it, the rail beside it and the decision in the footer.
function reviewSlots(args: {
  review: AiReview;
  result: Result;
  note: NoteDetail;
  original: string;
  draft: string;
  setDraft: (draft: string) => void;
  selection: ReturnType<typeof useReviewSelection>;
  asideTitle: string;
}): ReviewSlot {
  const { review, result, note, original, draft, setDraft, selection } = args;
  return {
    value: draft,
    onCommit: setDraft,
    banner: <ReviewBand review={review} result={result} />,
    asideTitle: args.asideTitle,
    aside: (
      <ReviewRail
        review={review}
        result={result}
        currentTags={note.tags}
        original={original}
        selection={selection}
      />
    ),
    footer: <ReviewActions review={review} result={result} draft={draft} selection={selection} />,
  };
}
// Review mode lives while the expanded view is open on the content: entering it opens the view
// with the rewrite as the field's draft; the view closing, Keep or Discard all end it. The draft
// and the selection start from the proposal each time review is entered, so an abandoned edit
// does not linger.
function useReviewMode(focus: DetailApi<object>['focus'], proposal: Result | null) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  // The view closing ends the review: the key was `content` and is no longer. The key arrives a
  // render after Review asks for it, so its absence alone says nothing.
  const [wasContent, setWasContent] = useState(focus.key === 'content');
  if (focus.key === 'content' && !wasContent) setWasContent(true);
  if (focus.key !== 'content' && wasContent) {
    setWasContent(false);
    setOpen(false);
  }
  return {
    open: open && focus.key === 'content',
    draft,
    setDraft,
    enter: () => {
      setDraft(proposal?.refined_content ?? '');
      setOpen(true);
      focus.set('content');
    },
    leave: () => setOpen(false),
  };
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
