// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { ToastHost } from '@/ui/layout/toast/ToastHost';
import { useUndoToast, type UndoToast } from '@/ui/layout/toast/use-undo-toast';
import { EntityFooter, EntityUpdated } from '../EntityFooter';
afterEach(cleanup);
function Harness({ toasts }: { toasts: UndoToast[] }) {
  const undoToast = useUndoToast();
  return (
    <button type="button" onClick={() => toasts.forEach((toast) => undoToast(toast))}>
      {en.common.confirm}
    </button>
  );
}
function mount(toasts: UndoToast[]) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ToastHost>
        <Harness toasts={toasts} />
      </ToastHost>
    </NextIntlClientProvider>,
  );
  screen.getByRole('button', { name: en.common.confirm }).click();
}
const undoButtons = () => screen.getAllByRole('button', { name: en.common.undo });
it('EP-B36 a reversible action reports itself with the operation it can undo', async () => {
  const undo = vi.fn().mockResolvedValue(undefined);
  mount([{ message: en.tasks.deletedToast, undo }]);
  await waitFor(() => expect(screen.getByText(en.tasks.deletedToast)).toBeTruthy());
  expect(undo).not.toHaveBeenCalled();
  undoButtons()[0]?.click();
  await waitFor(() => expect(undo).toHaveBeenCalledTimes(1));
  // The receipt goes once the restore has landed; it does not linger claiming an action it no
  // longer offers.
  await waitFor(() => expect(screen.queryByText(en.tasks.deletedToast)).toBeNull());
});
it('EP-B36 a failed undo keeps the server state and names the path that still works', async () => {
  const undo = vi.fn().mockRejectedValue(new Error('conflict'));
  mount([{ message: en.tasks.deletedToast, undo }]);
  await waitFor(() => expect(screen.getByText(en.tasks.deletedToast)).toBeTruthy());
  undoButtons()[0]?.click();
  await waitFor(() => expect(screen.getByText(en.common.undoFailed)).toBeTruthy());
  // The action is gone, so the reader is not invited to retry into the same conflict.
  expect(screen.queryByRole('button', { name: en.common.undo })).toBeNull();
});
it('EP-B36 a newer action does not take an older one away', async () => {
  const first = vi.fn().mockResolvedValue(undefined);
  const second = vi.fn().mockResolvedValue(undefined);
  mount([
    { message: en.tasks.deletedToast, undo: first },
    { message: en.notes.deletedToast, undo: second },
  ]);
  await waitFor(() => expect(undoButtons()).toHaveLength(2));
  expect(screen.getByText(en.tasks.deletedToast)).toBeTruthy();
  expect(screen.getByText(en.notes.deletedToast)).toBeTruthy();
});
it('EP-B37 every record closes with one delete control, in the danger ink and inside the footer', () => {
  const remove = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EntityFooter remove={remove}>
        <EntityUpdated at="2026-09-16T09:00:00.000Z" />
      </EntityFooter>
    </NextIntlClientProvider>,
  );
  const button = screen.getByRole('button', { name: en.common.delete });
  expect(button.closest('footer')).not.toBeNull();
  expect(button.className).toContain('text-danger');
  // Not the filled destructive variant: that weight is reserved for what cannot be taken back.
  expect(button.className).not.toContain('bg-destructive');
});
it('EP-B37 a record already in the trash offers no delete control', () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EntityFooter remove={null}>
        <EntityUpdated at="2026-09-16T09:00:00.000Z" />
      </EntityFooter>
    </NextIntlClientProvider>,
  );
  expect(screen.queryByRole('button', { name: en.common.delete })).toBeNull();
});
