'use client';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useLinkGuard } from './use-link-guard';
import { useNavigationGuard } from './use-navigation-guard';
import { useSaveQueue } from './use-save-queue';
import { DeleteEntityDialog, UnsavedEntityDialog } from './EntityDialogs';
import type { Entity, DetailApi, EntityPageProps, SaveState } from './types';
type Props<T extends Entity, P extends object, C> = {
  item: T;
  mutations: EntityPageProps<T, P, C>['mutations'];
  render: (item: T, api: DetailApi<P>) => ReactNode;
  name: string;
  reload: () => Promise<T | undefined>;
  close: () => void;
  move: (direction: number) => void;
  neighbors: { previous: boolean; next: boolean; position: number; count: number };
};
export function EntityPanel<T extends Entity, P extends object, C>(props: Props<T, P, C>) {
  const t = useTranslations('common');
  const focusRoot = useRef<HTMLDivElement>(null);
  // sync: focus the selected entity's title after the detail surface mounts.
  useEffect(() => {
    focusRoot.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, []);
  const c = usePanelController(props);
  return (
    <>
      <PanelToolbar
        state={c.queue.state}
        neighbors={props.neighbors}
        move={(direction) => void c.navigate(() => props.move(direction))}
        close={() => void c.navigate(props.close)}
      />
      <div ref={focusRoot} className="p-5">
        {c.queue.error && <ErrorPanel error={c.queue.error} />}
        {c.queue.state === 'conflict' && <p className="my-3 text-sm">{t('conflictReapply')}</p>}
        {c.queue.error && (
          <Button className="my-3" variant="outline" onClick={() => void c.queue.retry()}>
            {t(c.queue.state === 'conflict' ? 'reapply' : 'retry')}
          </Button>
        )}
        {c.error && <ErrorPanel error={c.error} />}
        {props.render(props.item, {
          save: c.queue.save,
          close: () => void c.navigate(props.close),
          remove: () => c.setDeleting(true),
          restore: () => void c.restore(),
          saveState: c.queue.state,
          retry: () => void c.queue.retry(),
        })}
      </div>
      <DeleteEntityDialog
        open={c.deleting}
        setOpen={c.setDeleting}
        name={props.name}
        remove={c.remove}
      />
      <UnsavedEntityDialog
        navigation={c.navigation}
        setNavigation={() => c.setNavigation(null)}
        queue={c.queue}
      />
    </>
  );
}
function usePanelController<T extends Entity, P extends object, C>(props: Props<T, P, C>) {
  const t = useTranslations('common');
  const queue = useSaveQueue(props.item, props.mutations.patch, props.reload);
  const [deleting, setDeleting] = useState(false);
  const [navigation, setNavigation] = useState<(() => void) | null>(null);
  const [error, setError] = useState<Error | null>(null);
  async function navigate(action: () => void) {
    if (await queue.settle()) action();
    else setNavigation(() => action);
  }
  useNavigationGuard(navigate, queue.state);
  useLinkGuard(navigate);
  async function remove() {
    try {
      if (!(await queue.settle())) {
        setDeleting(false);
        return;
      }
      await props.mutations.remove(
        props.item.id,
        Math.max(queue.latest()?.revision ?? 0, props.item.revision),
      );
      props.close();
    } catch (error) {
      setError(error instanceof Error ? error : new Error(t('error')));
    }
    setDeleting(false);
  }
  async function restore() {
    if (!props.item.deletedOpId) return;
    try {
      await props.mutations.restore(props.item.id, props.item.deletedOpId);
      props.close();
    } catch (error) {
      setError(error instanceof Error ? error : new Error(t('error')));
    }
  }
  return {
    queue,
    deleting,
    setDeleting,
    navigation,
    setNavigation,
    error,
    navigate,
    remove,
    restore,
  };
}
function PanelToolbar({
  state,
  neighbors,
  move,
  close,
}: {
  state: SaveState;
  neighbors: { previous: boolean; next: boolean; position: number; count: number };
  move: (direction: number) => void;
  close: () => void;
}) {
  const t = useTranslations('common');
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-surface p-2">
      <div className="flex gap-1">
        <Button
          variant="ghost"
          disabled={!neighbors.previous}
          aria-label={t('previous')}
          onClick={() => move(-1)}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          disabled={!neighbors.next}
          aria-label={t('next')}
          onClick={() => move(1)}
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>
      <div role="status" className="text-xs text-text-muted">
        {state === 'saving' ? t('saving') : state === 'saved' ? t('saved') : null}
      </div>
      <Button variant="ghost" aria-label={t('close')} onClick={close}>
        <X className="size-4" />
        <span className="lg:sr-only">{t('back')}</span>
      </Button>
    </div>
  );
}
