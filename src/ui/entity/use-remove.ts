'use client';
import { useTranslations } from 'next-intl';
import { useUndoToast } from '@/ui/layout/toast/use-undo-toast';
import type { Entity, EntityPageProps } from './types';
type Removable<T extends Entity, P, C> = {
  item: T;
  deletedMessage: string;
  mutations: EntityPageProps<T, P, C>['mutations'];
  close: () => void;
};
type Settling = { settle: () => Promise<boolean>; latest: () => { revision: number } | undefined };
// EP-B36: a soft delete is reversible, so it runs on the press. The record goes, the panel closes
// behind it, and the receipt beside the list carries the way back. The revision sent is the newest
// the panel knows about, so an edit still settling does not make the delete stale. A delete that
// fails leaves the panel open and the record where it was, with the error above it.
export function useRemove<T extends Entity, P extends object, C>(
  props: Removable<T, P, C>,
  queue: Settling,
  fail: (failure: Error) => void,
) {
  const t = useTranslations('common');
  const undoToast = useUndoToast();
  return async () => {
    if (!(await queue.settle())) return;
    const { id } = props.item;
    const revision = Math.max(queue.latest()?.revision ?? 0, props.item.revision);
    try {
      const { opId } = await props.mutations.remove(id, revision);
      props.close();
      undoToast({
        message: props.deletedMessage,
        undo: async () => {
          await props.mutations.restore(id, opId);
        },
      });
    } catch (failure) {
      fail(failure instanceof Error ? failure : new Error(t('error')));
    }
  };
}
