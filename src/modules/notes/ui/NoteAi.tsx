'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { z } from 'zod';
import { WandSparkles } from 'lucide-react';
import { useAiReview, type AiReview } from '@/ui/ai/queries';
import { reviewReady } from '@/ui/ai/AiReviewStatus';
import { Button } from '@/ui/primitives/button';
import type { DetailApi } from '@/ui/entity/types';
import { type NoteDetail } from '../schema/validation';
import { RefinementOutput } from '../schema/validation';
import {
  ReviewActions,
  ReviewHeader,
  ReviewOriginal,
  useReviewSelection,
  type ReviewView,
} from './NoteReview';
import { ReviewAlsoCreate } from './NoteReviewCard';
import { NoteTagAi } from './NoteTagAi';
import { NoteAiRow, NoteAiStartError } from './NoteAiRow';
import type { ReviewSlot } from './NoteFields';
type Slots = {
  content: ReactNode;
  contentNotice: ReactNode;
  tags: ReactNode;
  review: ReviewSlot | null;
};
type Result = z.infer<typeof RefinementOutput>;
// NOTES-B22: each AI action sits on the label row of the field it changes — refine with the content
// it rewrites, tag suggestions with the tags they fill — rather than in a row above the record. It
// acts on one field, not the record, and a reader reaches for it while looking at that field; put
// at the top it also took the first read from the record's own title. The fields arrive as a render
// prop so this component keeps the review it owns while the slots land where they belong.
// NOTES-B18: a finished proposal never replaces the record. The label row's Review opens the
// expanded view (EP-B44) as a review surface: the rewrite in the field itself, the original a
// view away, what else it brings in a card, and the decision in the footer; closing the view puts
// the note's own text back and keeps the proposal for later.
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
  const mode = useReviewMode(focus, proposal.success ? proposal.data : null);
  const selection = useReviewSelection(review, mode.leave);
  const reviewing = ready && proposal.success && job && mode.open;
  const open = () => {
    if (proposal.success) selection.reset(proposal.data);
    mode.enter();
  };
  const slots = buildSlots({
    note,
    review,
    ready,
    proposal: reviewing && proposal.success && job ? { result: proposal.data, job } : null,
    mode,
    selection,
    open,
  });
  return children(slots);
}
// The label row carries the AI's presence as quietly as the field allows (NoteAiRow); what waits
// or went wrong sits on the field itself; under review the fields get the review surface.
function buildSlots(args: {
  note: NoteDetail;
  review: AiReview;
  ready: boolean;
  proposal: { result: Result; job: NonNullable<AiReview['job']> } | null;
  mode: ReturnType<typeof useReviewMode>;
  selection: ReturnType<typeof useReviewSelection>;
  open: () => void;
}): Slots {
  const { note, review, ready, proposal, mode, selection, open } = args;
  return {
    content: !ready ? <NoteAiRow review={review} empty={!note.content.trim()} /> : null,
    // What waits or went wrong sits on the field: the finished rewrite, or why one could not start.
    contentNotice:
      ready && !proposal ? (
        <RewriteReady open={open} />
      ) : review.start.error ? (
        <NoteAiStartError error={review.start.error} />
      ) : null,
    tags: <NoteTagAi note={note} />,
    review: proposal
      ? reviewSlots({
          review,
          result: proposal.result,
          note,
          original: proposal.job.originalContent ?? note.content,
          mode,
          selection,
        })
      : null,
  };
}
// What the fields get while a proposal is under review: the rewrite as the content's draft, and
// the review surface around it.
function reviewSlots(args: {
  review: AiReview;
  result: Result;
  note: NoteDetail;
  original: string;
  mode: ReturnType<typeof useReviewMode>;
  selection: ReturnType<typeof useReviewSelection>;
}): ReviewSlot {
  const { review, result, note, original, mode, selection } = args;
  return {
    value: mode.draft,
    onCommit: mode.setDraft,
    review: {
      mode: mode.view,
      header: (
        <ReviewHeader review={review} result={result} view={mode.view} setView={mode.setView} />
      ),
      original: <ReviewOriginal content={original} />,
      aside: (
        <ReviewAlsoCreate
          review={review}
          result={result}
          currentTags={note.tags}
          selection={selection}
        />
      ),
      footer: (
        <ReviewActions review={review} result={result} draft={mode.draft} selection={selection} />
      ),
    },
  };
}
// Review mode lives while the expanded view is open on the content: entering it opens the view
// with the rewrite as the field's draft; the view closing, Keep or Discard all end it. The draft,
// the selection and the view start afresh each time review is entered, so an abandoned edit does
// not linger.
function useReviewMode(focus: DetailApi<object>['focus'], proposal: Result | null) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [view, setView] = useState<ReviewView>('rewrite');
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
    view,
    setView,
    enter: () => {
      setDraft(proposal?.refined_content ?? '');
      setView('rewrite');
      setOpen(true);
      focus.set('content');
    },
    leave: () => setOpen(false),
  };
}
// A finished rewrite waits on the field it rewrote: one line and the way in.
function RewriteReady({ open }: { open: () => void }) {
  const t = useTranslations('ai');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <WandSparkles className="size-4 text-accent" aria-hidden />
        {t('rewriteReady')}
      </span>
      <Button size="sm" onClick={open}>
        {t('review')}
      </Button>
    </div>
  );
}
