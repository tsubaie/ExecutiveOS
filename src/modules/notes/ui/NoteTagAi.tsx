'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AiPanel } from '@/ui/ai/AiPanel';
import { useAiReview, type AiReview } from '@/ui/ai/queries';
import { Button } from '@/ui/primitives/button';
import { type NoteDetail } from '../schema/validation';
import { TagOutput } from '../schema/validation';
import { SuggestedTags } from './NoteRefineParts';
export function NoteTagAi({ note }: { note: NoteDetail }) {
  const t = useTranslations('ai');
  const review = useAiReview('notes.suggest_tags', note.id, note.revision, `/notes/${note.id}/suggest-tags`);
  const proposal = TagOutput.safeParse(review.job?.result?.output);
  return <AiPanel review={review} title={t('suggestTags')}>
    {proposal.success && <TagProposal key={review.job?.id} review={review} tags={proposal.data.tags} currentTags={note.tags} />}
  </AiPanel>;
}
function TagProposal({ review, tags, currentTags }: { review: AiReview; tags: string[]; currentTags: string[] }) {
  const t = useTranslations('ai');
  const [indexes, setIndexes] = useState<number[]>([]);
  const busy = review.apply.isPending || review.discard.isPending;
  return <div className="space-y-4">
    <SuggestedTags tags={tags} currentTags={currentTags} selected={indexes} setSelected={setIndexes} disabled={busy} />
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || review.stale || !indexes.length} onClick={() => review.apply.mutate({ jobId: review.job?.id ?? '', acceptContent: false, taskIndexes: [], tagIndexes: indexes })}>{t('applySelected')}</Button>
      {review.stale && review.enabled && <Button variant="outline" disabled={busy || review.pending} onClick={() => review.start.mutate()}>{t('regenerate')}</Button>}
      <Button variant="outline" disabled={busy} onClick={() => review.discard.mutate()}>{t('discard')}</Button>
    </div>
  </div>;
}
