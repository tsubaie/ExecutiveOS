'use client';
import type { KeyboardEvent, ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/primitives/dialog';
// NOTES-B18: a proposal under review takes over the expanded view. The header carries the way to
// look at it (the rewrite, the original, or both side by side), the field beneath is the rewrite
// itself, the original renders read-only where the mode asks for it, the aside is what else the
// proposal brings, and the footer holds the decision.
export type ExpandReview = {
  header: ReactNode;
  mode: 'rewrite' | 'original' | 'both';
  original: ReactNode;
  aside: ReactNode;
  footer: ReactNode;
};
// EP-B44: a field can move into the expanded view. `title` heads that view; the labels name the
// control both ways; `open` is owned by the caller, who carries it in the URL.
export type Expand = {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  labels: { expand: string; collapse: string; description: string; away: string };
  review?: ExpandReview | undefined;
};
// An action that transforms this field belongs on its label row, not in a header above the record:
// it changes one field, and a reader reaches for it while looking at that field.
export function FieldLabel({
  id,
  label,
  action,
}: {
  id: string;
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {action}
    </div>
  );
}
// EP-B44: the way into the expanded view sits inside the text's own box, in its top end corner,
// where the text it enlarges is; the record's placeholder keeps the way back in the same corner.
// It is raised on its own surface so it reads as a control over the text, not as part of it.
export function ExpandToggle({ expand, exit = false }: { expand: Expand; exit?: boolean }) {
  const label = exit ? expand.labels.collapse : expand.labels.expand;
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="absolute top-1.5 end-1.5 z-20 bg-surface text-text-muted shadow-sm hover:text-text"
      aria-label={label}
      title={label}
      onClick={() => expand.setOpen(!exit)}
    >
      {exit ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </Button>
  );
}
// The field either sits in the record, or leaves behind its label and the way back while it is
// in the expanded view, so the record still says where the text went.
export function FieldFrame({
  id,
  label,
  className,
  expand,
  children,
}: {
  id: string;
  label: string;
  className?: string | undefined;
  expand?: Expand | undefined;
  children: ReactNode;
}) {
  if (!expand?.open) return children;
  return (
    <>
      <div className={cn('grid gap-2', className)}>
        <FieldLabel id={`${id}-away`} label={label} />
        <div className="relative min-h-20 rounded-lg border border-dashed px-3 py-2 text-sm text-text-muted">
          {expand.labels.away}
          <ExpandToggle expand={expand} exit />
        </div>
      </div>
      <ExpandedField
        title={expand.title}
        description={expand.labels.description}
        open={expand.open}
        onOpenChange={expand.setOpen}
        review={expand.review}
      >
        {children}
      </ExpandedField>
    </>
  );
}
// EP-B44 / NOTES-B28: the field with the lights turned up. The same field moves into a dialog
// that takes most of the window and holds nothing but the record's title and the text, set at a
// wide writing measure with looser leading, the text filling the height. It is the same field,
// not a copy: whatever it can do in the record it can do here.
export function ExpandedField({
  title,
  description,
  open,
  onOpenChange,
  review,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review?: ExpandReview | undefined;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDownCapture={escapeLeavesTextFirst}
        className="flex h-[94dvh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1240px,calc(100%-2rem))]"
      >
        <div className="border-b py-4 ps-4 pe-14 sm:ps-6">
          <DialogTitle dir="auto" className="truncate text-lg font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
          {review?.header}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-8 sm:py-6">
          {review ? (
            <ReviewColumns review={review}>{children}</ReviewColumns>
          ) : (
            <Writing>{children}</Writing>
          )}
        </div>
        {review && (
          <div className="border-t bg-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
            {review.footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
// Reading and writing typography: a wide measure, looser leading, and headings that step above
// the body so a note's sections read as sections.
const TYPE =
  'text-base leading-7 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:text-pretty [&_h3]:text-base [&_h3]:text-pretty [&_textarea]:text-base [&_textarea]:leading-7';
function Writing({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[92ch] [&_[data-checklist]]:min-h-[calc(94dvh-13rem)] [&_textarea]:min-h-[calc(94dvh-13rem)]',
        TYPE,
      )}
    >
      {children}
    </div>
  );
}
// The review's columns by mode: the rewrite beside the aside; the original in the rewrite's
// place; or both texts side by side with the aside beneath. Below 1024 px everything stacks in
// that order, the aside always after the text.
function ReviewColumns({ review, children }: { review: ExpandReview; children: ReactNode }) {
  const both = review.mode === 'both';
  return (
    <div className={cn('mx-auto w-full max-w-[150ch]', TYPE)}>
      <div
        className={cn(
          'grid gap-8',
          both ? 'lg:grid-cols-2' : 'lg:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)]',
        )}
      >
        {review.mode !== 'rewrite' && <div className="min-w-0">{review.original}</div>}
        <div className={cn('min-w-0', review.mode === 'original' && 'hidden')}>{children}</div>
        <div className={cn('min-w-0', both && 'lg:col-span-2')}>{review.aside}</div>
      </div>
    </div>
  );
}
// Escape layers: from the textarea it leaves the text (which commits and shows the preview); the
// next Escape closes the view; the one after that closes the record (EP-B06). An open mention
// list keeps its own Escape. Focus moves to the view itself rather than falling to the body:
// the entity surface reads Escape with focus nowhere as "close the record" (EP-B06), which would
// take the record down with the view.
function escapeLeavesTextFirst(event: KeyboardEvent<HTMLDivElement>) {
  const target = event.target;
  if (event.key !== 'Escape' || !(target instanceof HTMLTextAreaElement)) return;
  if (target.getAttribute('aria-expanded') === 'true') return;
  event.preventDefault();
  event.stopPropagation();
  target.blur();
  event.currentTarget.focus();
}
