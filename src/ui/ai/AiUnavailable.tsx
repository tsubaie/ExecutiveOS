'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/primitives/popover';
import { routes } from '@/core/routes';
import type { z } from 'zod';
import { AiCapability } from '@/core/config/ai-capabilities';
import { type AiReview } from './queries';
// Two states wear one message badly, so this tells them apart.
//
// A workspace that has never set AI up is not faulty, and saying so on every record is a car
// reporting that cruise control is not installed each time it is driven. Only a reader who can turn
// it on hears about it, and what they get is an invitation rather than a fault: no "check again",
// because nothing has changed for a check to find.
//
// A workspace that does use AI and cannot reach it right now is a different thing: everyone hears
// about it, because a member has lost a control they had yesterday and deserves to know why, and
// checking again is worth offering because the answer really can change.
//
// Either way the notice takes the slot and weight of the control it stands in for — one muted line
// at the end of the AI's own row — rather than the bordered block above the record's title that
// made a tool's health the first thing a reader saw about their own note. The explanation is worth
// reading once and noise every time after, so it sits behind an info control: dismissal would cost
// state, come back next session, and hide the detail from the administrator who arrives later and
// is the one person who can act.
// The catalog is two levels deep by contract, and a capability's own id carries a dot that
// next-intl would read as a path, so the detail line is looked up through a map of literal keys.
const detail: Record<z.infer<typeof AiCapability>, 'unavailableRefine' | 'unavailableTags' | 'unavailableBreakdown'> = {
  'notes.refine': 'unavailableRefine',
  'notes.suggest_tags': 'unavailableTags',
  'tasks.breakdown': 'unavailableBreakdown',
};
// The notice names the five fields it actually reads rather than taking the whole review: it does
// not depend on the job, and saying so keeps the dependency honest.
type Unavailable = Pick<
  AiReview,
  'capability' | 'configured' | 'canConfigure' | 'checkingAvailability' | 'recheckAvailability'
>;
export function AiUnavailable({ review }: { review: Unavailable }) {
  const t = useTranslations('ai');
  if (!review.configured && !review.canConfigure) return null;
  return (
    <p
      role="status"
      className="mb-4 flex flex-wrap items-center justify-end gap-1.5 text-sm text-text-faint"
    >
      {t(review.configured ? 'unavailable' : 'off')}
      <Popover>
        <PopoverTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={t('unavailableDetails')} />}
        >
          <Info className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="grid gap-2 text-start">
          <span>{t(detail[review.capability])}</span>
          {review.canConfigure && (
            <Link href={routes.admin('ai')} className="text-accent">
              {t('turnOn')}
            </Link>
          )}
        </PopoverContent>
      </Popover>
      {review.configured && (
        <Button
          variant="ghost"
          size="sm"
          disabled={review.checkingAvailability}
          onClick={() => void review.recheckAvailability()}
        >
          {t('checkAvailability')}
        </Button>
      )}
    </p>
  );
}
