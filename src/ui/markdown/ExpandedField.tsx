'use client';
import type { KeyboardEvent, ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/primitives/dialog';
// EP-B44: a field can move into the expanded view. `title` heads that view; the labels name the
// control both ways; `open` is owned by the caller, who carries it in the URL.
export type Expand = {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  labels: { expand: string; collapse: string; description: string };
  // A band above the text in the expanded view (a proposal under review, NOTES-B18) and a second
  // column beside it (the original the proposal rewrote).
  banner?: ReactNode;
  aside?: ReactNode;
};
// An action that transforms this field belongs on its label row, not in a header above the record:
// it changes one field, and a reader reaches for it while looking at that field.
export function FieldLabel({
  id,
  label,
  action,
  expand,
}: {
  id: string;
  label: string;
  action?: ReactNode;
  expand?: Expand | undefined;
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {expand ? (
        <div className="flex flex-wrap items-center gap-2">
          {action}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={expand.open ? expand.labels.collapse : expand.labels.expand}
            title={expand.open ? expand.labels.collapse : expand.labels.expand}
            onClick={() => expand.setOpen(!expand.open)}
          >
            {expand.open ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      ) : (
        action
      )}
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
        <FieldLabel id={`${id}-away`} label={label} expand={expand} />
      </div>
      <ExpandedField
        title={expand.title}
        description={expand.labels.description}
        open={expand.open}
        onOpenChange={expand.setOpen}
        banner={expand.banner}
        aside={expand.aside}
      >
        {children}
      </ExpandedField>
    </>
  );
}

// EP-B44 / NOTES-B28: the field with the lights turned up. The same field moves into a dialog
// that takes most of the window and holds nothing but the record's title and the text, set at a
// wide writing measure with looser leading, the text filling the height so the page reads as a
// page rather than a box in one. It is the same field, not a copy: whatever it can do in the
// record it can do here.
export function ExpandedField({
  title,
  description,
  open,
  onOpenChange,
  banner,
  aside,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner?: ReactNode | undefined;
  aside?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDownCapture={escapeLeavesTextFirst}
        className="flex h-[94dvh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1240px,calc(100%-2rem))]"
      >
        <div className="border-b px-6 py-4 pe-14">
          <DialogTitle dir="auto" className="truncate text-lg font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-8 sm:py-6">
          <div
            className={cn(
              'mx-auto w-full text-base leading-7 [&_textarea]:min-h-[calc(94dvh-13rem)] [&_textarea]:text-base [&_textarea]:leading-7 [&_[data-checklist]]:min-h-[calc(94dvh-13rem)]',
              aside ? 'grid max-w-[184ch] gap-6 lg:grid-cols-2' : 'max-w-[92ch]',
            )}
          >
            <div className="min-w-0">
              {banner}
              {children}
            </div>
            {aside && <div className="min-w-0">{aside}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
