'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useCount } from '@/ui/format';
import type { BulkAction, Entity } from './types';
type Props<T extends Entity> = { items: T[]; actions: BulkAction<T>[]; clear: () => void };
export function EntityBulkBar<T extends Entity>({ items, actions, clear }: Props<T>) {
  const t = useTranslations('common');
  const count = useCount();
  const [active, setActive] = useState<BulkAction<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const finish = (clearSelection: boolean) => {
    setActive(null);
    if (clearSelection) clear();
  };
  async function run(action: BulkAction<T>) {
    try {
      await action.run?.(items);
      finish(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error(t('error')));
      setActive(null);
    }
  }
  return (
    <div data-entity-bulk className="grid gap-2 border-t pt-3 text-xs text-text-muted">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{t('selectedCount', { count: count(items.length) })}</span>
        <div className="flex flex-wrap gap-1">
          {actions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant="outline"
              disabled={!items.length || action.enabled?.(items) === false}
              onClick={() =>
                action.confirm || action.render ? setActive(action) : void run(action)
              }
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
      {error && <ErrorPanel error={error} />}
      {active?.render ? active.render(items, finish) : null}
      {active?.confirm && (
        <ConfirmBulk action={active} onCancel={() => finish(false)} onConfirm={() => run(active)} />
      )}
    </div>
  );
}
function ConfirmBulk<T extends Entity>({
  action,
  onCancel,
  onConfirm,
}: {
  action: BulkAction<T>;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useTranslations('common');
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogTitle>{action.confirm?.title}</DialogTitle>
        <DialogDescription>{action.confirm?.description}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void onConfirm()}>{t('confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
