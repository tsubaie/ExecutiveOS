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
// NOTES-B22: each AI action sits on the label row of the field it changes — refine with the content
// it rewrites, tag suggestions with the tags they fill — rather than in a row above the record. It
// acts on one field, not the record, and a reader reaches for it while looking at that field; put
// at the top it also took the first read from the record's own title. The fields arrive as a render
// prop so this component keeps the review it owns while the slots land where they belong.
export function NoteAi({
  note,
  children,
}: {
  note: NoteDetail;
  children: (slots: { content: ReactNode; tags: ReactNode }) => ReactNode;
}) {
  const review = useAiReview('notes.refine', note.id, note.revision, `/notes/${note.id}/refine`);
  const [hiddenJob, setHiddenJob] = useState<string | null>(null);
  const job = review.job;
  const proposal = RefinementOutput.safeParse(job?.result?.output);
  const ready = reviewReady(review) && proposal.success;
  if (ready && proposal.success && job && hiddenJob !== job.id && !review.pending)
    return (
      <NoteRefineReview
        key={job.id}
        review={review}
        result={proposal.data}
        original={job.originalContent ?? note.content}
        currentTags={note.tags}
        back={() => setHiddenJob(job.id)}
      />
    );
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
              reopen={() => setHiddenJob(null)}
            />
            <AiAvailabilityNotice review={review} />
          </>
        ),
        tags: <NoteTagAi note={note} />,
      })}
    </>
  );
}
// Hidden rather than disabled while there is nothing to refine: a control that cannot act and does
// not say why is a dead end, and an action that does not apply yet is not information.
function RefineButton({
  review,
  ready,
  empty,
  reopen,
}: {
  review: AiReview;
  ready: boolean;
  empty: boolean;
  reopen: () => void;
}) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  if (!review.enabled && !ready && !review.pending) return null;
  if (empty && !ready && !review.pending) return null;
  const label = review.pending
    ? t('refining')
    : ready
      ? t('reviewDraft')
      : review.job?.status === 'failed'
        ? c('retry')
        : t('refine');
  return (
    <Button
      variant="outline"
      size="sm"
      aria-busy={review.pending}
      disabled={review.pending}
      onClick={() => (ready ? reopen() : review.start.mutate())}
    >
      {review.pending ? (
        <LoaderCircle aria-hidden={true} className="size-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <WandSparkles className="size-4" />
      )}
      {label}
    </Button>
  );
}
