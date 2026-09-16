'use client';
import type { ReactNode } from 'react';
import {
  ToastAction,
  ToastClose,
  ToastContent,
  ToastPortal,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  useToastManager,
} from '@/ui/primitives/toast';

// Eight seconds is long enough to read one sentence and reach the action beside it. The primitive
// holds the timer while the viewport is hovered or focused, so a reader who is looking at the
// toast never loses it mid-reach, and Trash is the recovery path that outlives it either way.
const TOAST_TIMEOUT = 8000;
// Three at once, each independently undoable: a newer action never takes an older one's Undo away.
// Collapsed they peek over one another and cost about one row of height; the stack only opens out
// while the viewport is hovered or focused, which is the moment the reader wants to read it.
const TOAST_LIMIT = 3;

export function ToastHost({ children }: { children: ReactNode }) {
  return (
    <ToastProvider timeout={TOAST_TIMEOUT} limit={TOAST_LIMIT}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}

// One row and exactly one target: the action when the toast carries one, a dismiss when it does
// not. Undo and a close button side by side are two small neighbours, and the slip that costs the
// reader their only way back is the one that lands on the wrong one. A notice with nothing to do
// about it gets the dismiss instead, which is also what a failed undo turns into.
function ToastList() {
  const { toasts } = useToastManager();
  return toasts.map((toast) => (
    <ToastRoot key={toast.id} toast={toast}>
      <ToastContent>
        <ToastTitle />
        {toast.actionProps?.children ? <ToastAction /> : <ToastClose />}
      </ToastContent>
    </ToastRoot>
  ));
}
