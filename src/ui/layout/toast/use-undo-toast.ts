'use client';
import { useTranslations } from 'next-intl';
import { useToastManager } from '@/ui/primitives/toast';

export type UndoToast = {
  // The localized sentence the toast reads, naming the record it reports on.
  message: string;
  // The entity's real restore operation, addressed by the operation id the action returned. Undo
  // reverses the work; it never merely delays the request that did it. Its result is the caller's
  // business: the toast only needs to know whether it landed.
  undo: () => Promise<void>;
};

// The shared reversible-action receipt (docs/05 § Feedback). A confirm dialog in front of a
// reversible action asks at the moment of least attention — the reader has already decided — and
// it cannot catch the mistake that actually happens, which is acting on the wrong record. That one
// is only visible once the record has gone, which is where this offers Undo instead.
export function useUndoToast() {
  const t = useTranslations('common');
  const manager = useToastManager();
  return ({ message, undo }: UndoToast) => {
    const id = manager.add({
      title: message,
      actionProps: {
        children: t('undo'),
        onClick: () => {
          // Inert while the restore is in flight, so a second press cannot send it twice, and the
          // toast holds its ground instead of expiring mid-request.
          manager.update(id, { timeout: 0, actionProps: { children: t('undo'), disabled: true } });
          void undo().then(
            () => manager.close(id),
            // The server is the authority: the modules' mutation adapters refresh the affected
            // queries whether the restore succeeded or failed, so all that is left to do is say so
            // and name the path that still works. The notice stays until it is dismissed.
            () =>
              manager.update(id, {
                title: t('undoFailed'),
                priority: 'high',
                timeout: 0,
                actionProps: { children: undefined },
              }),
          );
        },
      },
    });
  };
}
