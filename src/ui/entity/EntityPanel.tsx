'use client';
import { useState, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useNavigationGuard, type NavigationGuard } from './navigation';
import { useSaveQueue } from './use-save-queue';
import { DeleteEntityDialog, UnsavedEntityDialog } from './EntityDialogs';
import type { Entity, DetailApi, EntityPageProps, Neighbors, SaveState } from './types';
type Props<T extends Entity, P extends object, C> = {
  item: T;
  mutations: EntityPageProps<T, P, C>['mutations'];
  render: (item: T, api: DetailApi<P>) => ReactNode;
  name: string;
  reload: () => Promise<T | undefined>;
  close: () => void;
  move: (direction: number) => void;
  neighbors: Neighbors;
};
export function EntityPanel<T extends Entity, P extends object, C>(props: Props<T, P, C>) {
  const t = useTranslations('common');
  const root = useRef<HTMLDivElement>(null);
  const c = usePanelController(props, root);
  // sync: focus the selected entity's title after the detail surface mounts.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, []);
  const guarded = (action: () => void) => () => void c.navigate(action);
  return (
    <>
      <PanelToolbar
        state={c.queue.state}
        neighbors={props.neighbors}
        move={(direction) => guarded(() => props.move(direction))()}
        close={guarded(props.close)}
      />
      <div ref={root} className="p-5">
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
          close: guarded(props.close),
          remove: () => c.setDeleting(true),
          restore: () => void c.restore(),
          saveState: c.queue.state,
          retry: () => void c.queue.retry(),
          next: guarded(() => props.move(1)),
          prev: guarded(() => props.move(-1)),
          neighbors: props.neighbors,
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
function usePanelController<T extends Entity, P extends object, C>(
  props: Props<T, P, C>,
  root: RefObject<HTMLDivElement | null>,
) {
  const t = useTranslations('common');
  const queue = useSaveQueue(props.item, props.mutations.patch, props.reload);
  const [deleting, setDeleting] = useState(false);
  const [navigation, setNavigation] = useState<(() => void) | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Blur commits a pending field, an invalid field blocks, a failed save asks first.
  const navigate: NavigationGuard = async (proceed) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.current?.contains(active)) active.blur();
    const invalid = root.current?.querySelector<HTMLInputElement>('input:invalid,textarea:invalid');
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (await queue.settle()) proceed();
    else setNavigation(() => proceed);
  };
  useNavigationGuard(navigate);
  useUnloadGuard(queue.state);
  const fail = (failure: unknown) =>
    setError(failure instanceof Error ? failure : new Error(t('error')));
  const remove = async () => {
    if (await queue.settle())
      await props.mutations
        .remove(props.item.id, Math.max(queue.latest()?.revision ?? 0, props.item.revision))
        .then(props.close, fail);
    setDeleting(false);
  };
  const restore = async () => {
    if (!props.item.deletedOpId) return;
    await props.mutations.restore(props.item.id, props.item.deletedOpId).then(props.close, fail);
  };
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
function useUnloadGuard(state: SaveState) {
  // sync: warn before the browser unloads while a save is unresolved.
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (['saving', 'error', 'conflict'].includes(state)) event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [state]);
}
function PanelToolbar({
  state,
  neighbors,
  move,
  close,
}: {
  state: SaveState;
  neighbors: Neighbors;
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
