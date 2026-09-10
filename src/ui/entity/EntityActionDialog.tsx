'use client';
import type { ReactNode } from 'react';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
// A bulk action that needs one small form (a title to group under, a tag to add): rendered by the
// bulk bar's `render` escape hatch; closing without submitting keeps the selection.
export function EntityActionDialog({
  title,
  description,
  submitLabel,
  error,
  pending,
  finish,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  error: Error | null;
  pending: boolean;
  finish: (clearSelection: boolean) => void;
  onSubmit: (fields: FormData) => Promise<void>;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {error && <ErrorPanel error={error} />}
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(new FormData(event.currentTarget));
          }}
        >
          {children}
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
