'use client';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useSaveQueue } from './use-save-queue';
import type { Entity, DetailApi, EntityPageProps } from './types';
type Props<T extends Entity, P extends object, C> = {
  item: T;
  mutations: EntityPageProps<T, P, C>['mutations'];
  render: (item: T, api: DetailApi<P>) => ReactNode;
  name: string;
  close: () => void;
  move: (direction: number) => void;
};
export function EntityPanel<T extends Entity, P extends object, C>({
  item,
  mutations,
  render,
  name,
  close,
  move,
}: Props<T, P, C>) {
  const focusRoot = useRef<HTMLDivElement>(null);
  // sync: focus the detail title when the panel enters the DOM.
  useEffect(() => {
    focusRoot.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, []);
  const t = useTranslations('common');
  const queue = useSaveQueue(item, mutations.patch);
  const [deleting, setDeleting] = useState(false);
  const [navigation, setNavigation] = useState<(() => void) | null>(null);
  const [error, setError] = useState<Error | null>(null);
  async function navigate(action: () => void) {
    if (await queue.settle()) action();
    else setNavigation(() => action);
  }
  async function remove() {
    try {
      await mutations.remove(item.id, item.revision);
      close();
    } catch (error) {
      setError(error instanceof Error ? error : new Error(t('error')));
    }
    setDeleting(false);
  }
  async function restore() {
    if (!item.deletedOpId) return;
    try {
      await mutations.restore(item.id, item.deletedOpId);
      close();
    } catch (error) {
      setError(error instanceof Error ? error : new Error(t('error')));
    }
  }
  return (
    <>
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            aria-label={t('previous')}
            onClick={() => void navigate(() => move(-1))}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            aria-label={t('next')}
            onClick={() => void navigate(() => move(1))}
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
        <div role="status" className="text-xs text-text-muted">
          {queue.state === 'saving' ? t('saving') : queue.state === 'saved' ? t('saved') : null}
        </div>
        <Button variant="ghost" aria-label={t('close')} onClick={() => void navigate(close)}>
          <X className="size-4" />
        </Button>
      </div>
      <div ref={focusRoot} className="p-5">
        {queue.error && <ErrorPanel error={queue.error} retry={() => void queue.retry()} />}{' '}
        {error && <ErrorPanel error={error} />}
        {render(item, {
          save: queue.save,
          close: () => void navigate(close),
          remove: () => setDeleting(true),
          restore: () => void restore(),
          saveState: queue.state,
          retry: () => void queue.retry(),
        })}
      </div>
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogTitle>{t('delete')}</DialogTitle>
          <DialogDescription>{t('deleteDescription', { name })}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void remove()}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(navigation)}
        onOpenChange={(open) => {
          if (!open) setNavigation(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{t('unsaved')}</DialogTitle>
          <DialogDescription>{queue.error?.message}</DialogDescription>
          <DialogFooter>
            <Button
              onClick={() =>
                void queue.retry().then(async () => {
                  if (await queue.settle()) {
                    navigation?.();
                    setNavigation(null);
                  }
                })
              }
            >
              {t('retry')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                queue.discard();
                navigation?.();
                setNavigation(null);
              }}
            >
              {t('discard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
