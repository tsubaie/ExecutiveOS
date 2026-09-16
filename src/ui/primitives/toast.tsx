'use client';

import { useTranslations } from 'next-intl';
import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import { cn } from '@/ui/cn';

import { Button } from '@/ui/primitives/button';

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />;
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal {...props} />;
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  const t = useTranslations('common');
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      // The primitive labels its own landmark region in English; the catalog owns every word the
      // reader hears, so the label is passed after it and wins the merge.
      aria-label={t('notices')}
      className={cn('outline-none', className)}
      {...props}
    />
  );
}

function ToastRoot({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      // Vertical only: a horizontal swipe would need mirroring for RTL, while down is the same
      // gesture in both directions.
      swipeDirection={['down']}
      className={cn('rounded-xl outline-none', className)}
      {...props}
    />
  );
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn('flex items-center gap-3 overflow-hidden p-2 ps-4', className)}
      {...props}
    />
  );
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn('min-w-0 flex-1 text-balance', className)}
      {...props}
    />
  );
}

function ToastAction({ className, ...props }: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      // A receipt, not an alarm: the fill is the accent the app confirms with, never the danger
      // red that belongs to the destructive control itself (docs/05 § Design system). The colour
      // itself lives in tokens.css, with the rest of the inverse ground it sits on.
      render={<Button variant="ghost" className={cn(className)} />}
      {...props}
    />
  );
}

function ToastClose({ className, ...props }: ToastPrimitive.Close.Props) {
  const t = useTranslations('common');
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      render={<Button variant="ghost" size="icon-sm" className={cn(className)} />}
      {...props}
    >
      <X />
      <span className="sr-only">{t('close')}</span>
    </ToastPrimitive.Close>
  );
}

const useToastManager = ToastPrimitive.useToastManager;

export {
  ToastAction,
  ToastClose,
  ToastContent,
  ToastPortal,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  useToastManager,
};
