'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { useDateTime, useRelativeTime } from '@/ui/format';
// EP-B37: every record closes the same way. The framework owned the deletion itself (EP-B36) but
// not where it was offered, so five modules grew four treatments of one action: the same reversible
// soft delete was a filled destructive button in People, muted grey until hovered in Tasks and
// KPIs, danger red in Notes, and in Committees a bare button with no footer under it at all. Weight
// is the only thing left telling a reader what an action costs now that a reversible delete no
// longer stops to ask, so it cannot vary by module. Ghost in the danger ink means reversible with
// Undo behind it; the filled destructive variant is reserved for the irreversible actions that do
// still confirm. The colour is not held back until hover either, because the office works on
// tablets and nothing hovers there (docs/05 § Mobile).
export function EntityFooter({
  children,
  actions,
  notice,
  remove,
}: {
  // What the module knows about the record: ownership, provenance, freshness.
  children?: ReactNode;
  // The module's own closing actions, which sit before the shared one.
  actions?: ReactNode;
  // An error raised by those actions, above the row rather than beside it.
  notice?: ReactNode;
  // Omitted or null while the record is already in the trash.
  remove?: (() => void) | null;
}) {
  const t = useTranslations('common');
  return (
    <footer className="mt-6 grid gap-2 border-t pt-3 text-xs text-text-muted">
      {notice}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">{children}</span>
        {(actions || remove) && (
          <span className="flex shrink-0 items-center gap-1">
            {actions}
            {remove && (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger focus-visible:text-danger"
                onClick={remove}
              >
                <Trash2 className="size-3.5" aria-hidden={true} />
                {t('delete')}
              </Button>
            )}
          </span>
        )}
      </div>
    </footer>
  );
}
// The one thing every record can say about itself: when it last changed, relative in the footer and
// exact on hover, the way the rest of the product divides the two (docs/05 § Copy and tone).
export function EntityUpdated({ at }: { at: string }) {
  const t = useTranslations('common');
  const dateTime = useDateTime();
  const relative = useRelativeTime();
  return <span title={dateTime(at)}>{t('updated', { date: relative(at) })}</span>;
}
