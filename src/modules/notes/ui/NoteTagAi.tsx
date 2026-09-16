'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { AiWorking, reviewReady } from '@/ui/ai/AiReviewStatus';
import { AiRequestError } from '@/ui/ai/AiRequestError';
import { useAiReview, type AiReview } from '@/ui/ai/queries';
import { Button } from '@/ui/primitives/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/primitives/popover';
import { type NoteDetail } from '../schema/validation';
import { TagOutput } from '../schema/validation';
import { SuggestedTags } from './NoteRefineParts';
// NOTES-B22: tag suggestions sit on the Tags label row as a single icon, and the whole exchange
// happens in a popover hanging off it, so the field the tags land in never leaves the reader's
// sight. An icon carries this one where it would not carry Refine: the label beside it already
// supplies the noun, so the mark only has to mean "suggest", and the action is additive and
// reversible — the reader ticks what they keep — where refining rewrites their own prose. Weight
// tracks consequence, so the heavier action keeps its words and this one does not.
export function NoteTagAi({ note }: { note: NoteDetail }) {
  const t = useTranslations('ai');
  const review = useAiReview(
    'notes.suggest_tags',
    note.id,
    note.revision,
    `/notes/${note.id}/suggest-tags`,
  );
  const [open, setOpen] = useState(false);
  if (!review.enabled && !review.job && !review.pending) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={t('suggestTags')} />}
        onClick={() => {
          if (!review.job && !review.pending) review.start.mutate();
        }}
      >
        <Sparkles className="size-4 text-accent" />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid gap-3">
        <TagState review={review} note={note} close={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
function TagState({
  review,
  note,
  close,
}: {
  review: AiReview;
  note: NoteDetail;
  close: () => void;
}) {
  const t = useTranslations('ai');
  const proposal = TagOutput.safeParse(review.job?.result?.output);
  if (review.pending) return <AiWorking review={review} />;
  if (review.error) return <AiRequestError error={review.error} />;
  if (!reviewReady(review) || !proposal.success)
    return (
      <Button variant="outline" size="sm" onClick={() => review.start.mutate()}>
        {t('generate')}
      </Button>
    );
  return (
    <TagProposal
      key={review.job?.id}
      review={review}
      tags={proposal.data.tags}
      currentTags={note.tags}
      close={close}
    />
  );
}
function TagProposal({
  review,
  tags,
  currentTags,
  close,
}: {
  review: AiReview;
  tags: string[];
  currentTags: string[];
  close: () => void;
}) {
  const t = useTranslations('ai');
  const [indexes, setIndexes] = useState<number[]>([]);
  const busy = review.apply.isPending || review.discard.isPending;
  const apply = () =>
    review.apply
      .mutateAsync({
        jobId: review.job?.id ?? '',
        acceptContent: false,
        taskIndexes: [],
        tagIndexes: indexes,
      })
      .then(close);
  return (
    <>
      {review.stale && (
        <p role="alert" className="text-sm text-danger">
          {t('stale')}
        </p>
      )}
      <SuggestedTags
        tags={tags}
        currentTags={currentTags}
        selected={indexes}
        setSelected={setIndexes}
        disabled={busy}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || review.stale || !indexes.length} onClick={() => void apply()}>
          {t('applySelected')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void review.discard.mutateAsync().then(close)}
        >
          {t('discard')}
        </Button>
      </div>
    </>
  );
}
