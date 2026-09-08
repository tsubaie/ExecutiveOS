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
  // PEOPLE-B07: the confirm button is inert while the removal is in flight, so a double press or
  // an impatient Enter cannot send the destructive mutation twice.
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    try {
      await remove();
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{t('delete')}</DialogTitle>
        <DialogDescription>{t('deleteDescription', { name })}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => void confirm()}>
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
