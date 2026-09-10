'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
// The create surface every module shares: a focusable heading, the last error, the module's
// fields, and Create / Cancel. The module parses the form data and calls the framework's submit.
export function EntityCreateForm({
  title,
  error,
  pending,
  cancel,
  onSubmit,
  children,
}: {
  title: string;
  error: Error | null;
  pending: boolean;
  cancel: () => void;
  onSubmit: (fields: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const c = useTranslations('common');
  return (
    <form
      className="grid gap-5 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <h2 tabIndex={-1} className="text-xl font-semibold">
        {title}
      </h2>
      {error && <ErrorPanel error={error} />}
      {children}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {c('create')}
        </Button>
        <Button variant="outline" onClick={cancel}>
          {c('cancel')}
        </Button>
      </div>
    </form>
  );
}
