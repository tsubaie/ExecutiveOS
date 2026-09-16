// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/core/i18n/messages/en.json';
import { ToastHost } from '@/ui/layout/toast/ToastHost';
import { TaskCheck } from '../../ui/TaskToggle';
const opId = '01a0a000-0000-7000-8000-0000000000bb';
const mutations = {
  complete: vi.fn(),
  undoComplete: vi.fn(),
  action: vi.fn(),
};
vi.mock('../../ui/queries', () => ({ useTaskMutations: () => mutations }));
beforeEach(() => {
  mutations.complete.mockResolvedValue({ data: {}, meta: { opId } });
  mutations.undoComplete.mockResolvedValue({});
  mutations.action.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const task = { id: '01a0a000-0000-7000-8000-000000000002', title: 'Approve the budget', revision: 4 };
function mount(extra: { completed?: boolean; subtask?: boolean } = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ToastHost>
        <TaskCheck task={{ ...task, completed: false, ...extra }} />
      </ToastHost>
    </NextIntlClientProvider>,
  );
}
it('TASKS-B02 completing a task reports itself and undoes through the completion operation', async () => {
  mount();
  screen.getByRole('checkbox').click();
  await waitFor(() => expect(mutations.complete).toHaveBeenCalledWith(task.id, 4, false));
  await waitFor(() => expect(screen.getByText(en.tasks.completedToast)).toBeTruthy());
  screen.getByRole('button', { name: en.common.undo }).click();
  // The exact-state undo, not `reopen`, which would land the task on next_action.
  await waitFor(() => expect(mutations.undoComplete).toHaveBeenCalledWith(task.id, opId));
  expect(mutations.action).not.toHaveBeenCalled();
});
it('TASKS-B02 a subtask says it is a subtask', async () => {
  mount({ subtask: true });
  screen.getByRole('checkbox').click();
  await waitFor(() => expect(screen.getByText(en.tasks.subtaskCompletedToast)).toBeTruthy());
});
it('TASKS-B02 reopening a completed task carries no toast, because it is a command and not an undo', async () => {
  mount({ completed: true });
  screen.getByRole('checkbox').click();
  await waitFor(() => expect(mutations.action).toHaveBeenCalledWith(task.id, 'reopen', { revision: 4 }));
  expect(screen.queryByRole('button', { name: en.common.undo })).toBeNull();
  expect(mutations.complete).not.toHaveBeenCalled();
});
