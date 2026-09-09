// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import en from '@/core/i18n/messages/en.json';
const counts = vi.hoisted(() => ({ value: null as number | null }));
vi.mock('../../ui/queries', () => ({ useTaskCount: () => counts.value }));
const { TaskCountBadge } = await import('../../ui/TaskCountBadge');
function mount(open: number | null) {
  counts.value = open;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider
        locale="en"
        messages={en}
        formats={{ number: { integer: { maximumFractionDigits: 0 } } }}
      >
        <TaskCountBadge />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
describe('shell task count', () => {
  afterEach(cleanup);
  it('TASKS-B17 shows the open count beside the tasks entry', () => {
    mount(7);
    expect(screen.getByText('7')).toBeTruthy();
  });
  it('TASKS-B17 renders nothing at zero or before the count arrives', () => {
    mount(0);
    expect(document.body.textContent).toBe('');
    cleanup();
    mount(null);
    expect(document.body.textContent).toBe('');
  });
});
