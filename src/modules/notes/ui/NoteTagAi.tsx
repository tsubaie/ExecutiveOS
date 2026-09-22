'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoaderCircle, WandSparkles } from 'lucide-react';
import { reviewReady } from '@/ui/ai/AiReviewStatus';
import { useAiReview, type AiReview } from '@/ui/ai/queries';
import { Button } from '@/ui/primitives/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/primitives/popover';
import { type NoteDetail } from '../schema/validation';
import { TagOutput } from '../schema/validation';
import { NoteAiStartError } from './NoteAiRow';
import { SuggestedTags } from './NoteRefineParts';
// NOTES-B22: tag suggestions sit on the Tags label row as a single icon, and the whole exchange
// happens in a popover hanging off it, so the field the tags land in never leaves the reader's
// sight. The popover is one small card: what it is, the tags to tick, and one action that says
// how many it adds. Suggestions the note does not carry yet start ticked; existing ones are
// marked and stay unticked, since adding them changes nothing.
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
        title={t('suggestTags')}
        onClick={() => {
          if (!review.job && !review.pending) review.start.mutate();
        }}
      >
        <WandSparkles className="size-4 text-accent" />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <WandSparkles className="size-4 text-accent" aria-hidden />
          {t('suggestedTags')}
        </h3>
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
  const c = useTranslations('common');
  const proposal = TagOutput.safeParse(review.job?.result?.output);
  if (review.pending)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-text-muted">
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        {review.cancelling ? t('cancelling') : t('suggesting')}
        {!review.cancelling && (
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto h-7 px-2"
            onClick={review.requestCancel}
          >
            {c('cancel')}
          </Button>
        )}
      </p>
    );
  if (review.error) return <NoteAiStartError error={review.error} />;
  if (!reviewReady(review) || !proposal.success)
    return (
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => review.start.mutate()}
      >
        {t('suggestTags')}
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
  const fresh = (tag: string) =>
    !currentTags.some((current) => current.toLowerCase() === tag.toLowerCase());
  const [indexes, setIndexes] = useState<number[]>(() =>
    tags.map((tag, index) => (fresh(tag) ? index : -1)).filter((index) => index >= 0),
  );
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
  if (!tags.length) return <p className="text-sm text-text-muted">{t('noTags')}</p>;
  return (
    <>
      <p className="text-sm text-text-muted">{review.stale ? t('stale') : t('tickToAdd')}</p>
      <SuggestedTags
        tags={tags}
        currentTags={currentTags}
        selected={indexes}
        setSelected={setIndexes}
        disabled={busy || review.stale}
        bare
      />
      <ProposalActions
        review={review}
        busy={busy}
        count={indexes.length}
        apply={() => void apply()}
        close={close}
      />
    </>
  );
}
// Dismiss at the start; at the end, the one action that says how many tags it adds, or the way
// to a fresh suggestion once the note moved on.
function ProposalActions({
  review,
  busy,
  count,
  apply,
  close,
}: {
  review: AiReview;
  busy: boolean;
  count: number;
  apply: () => void;
  close: () => void;
}) {
  const t = useTranslations('ai');
  return (
    <div className="flex items-center gap-2 border-t pt-3">
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => void review.discard.mutateAsync().then(close)}
      >
        {t('dismiss')}
      </Button>
      <span className="ms-auto" />
      {review.stale ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => review.start.mutate()}>
          {t('suggestAgain')}
        </Button>
      ) : (
        <Button size="sm" className="tabular-nums" disabled={busy || !count} onClick={apply}>
          {t('addTags', { count })}
        </Button>
      )}
    </div>
  );
}
