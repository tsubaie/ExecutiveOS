'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
export function DeleteEntityDialog({
  open,
  setOpen,
  name,
  remove,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  name: string;
  remove: () => Promise<void>;
}) {
  const t = useTranslations('common');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{t('delete')}</DialogTitle>
        <DialogDescription>{t('deleteDescription', { name })}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" onClick={() => void remove()}>
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function UnsavedEntityDialog({
  navigation,
  setNavigation,
  queue,
}: {
  navigation: (() => void) | null;
  setNavigation: (value: null) => void;
  queue: {
    error: Error | null;
    retry: () => Promise<void>;
    settle: () => Promise<boolean>;
    discard: () => void;
  };
}) {
  const t = useTranslations('common');
  const retry = async () => {
    await queue.retry();
    if (await queue.settle()) {
      navigation?.();
      setNavigation(null);
    }
  };
  const discard = () => {
    queue.discard();
    navigation?.();
    setNavigation(null);
  };
  return (
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
          <Button onClick={() => void retry()}>{t('retry')}</Button>
          <Button variant="outline" onClick={discard}>
            {t('discard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
