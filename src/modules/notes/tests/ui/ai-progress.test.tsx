// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { AiProgress } from '@/ui/ai/AiProgress';
import { mount } from './harness';
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('NOTES-B18 preserves elapsed job time after remount and queue transitions', () => {
  vi.useFakeTimers();
  const startedAt = Date.now() - 42000;
  const first = mount(<AiProgress stage="queued" startedAt={startedAt} />);
  expect(screen.getByText('Waiting for 42 seconds')).toBeTruthy();
  first.unmount();
  act(() => vi.advanceTimersByTime(5000));
  mount(<AiProgress stage="running" startedAt={startedAt} />);
  expect(screen.getByText('Waiting for 47 seconds')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText('Waiting for 48 seconds')).toBeTruthy();
});
it('NOTES-B18 shows immediate submission status and elapsed waiting time', () => {
  vi.useFakeTimers();
  mount(<AiProgress stage="starting" />);
  expect(screen.getByRole('status').textContent).toContain('Sending your AI request');
  expect(screen.getByText('Keep this page open while your request is being submitted.')).toBeTruthy();
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByText('Waiting for 3 seconds')).toBeTruthy();
});
it('NOTES-B18 distinguishes queued and running progress in Arabic', () => {
  mount(<AiProgress stage="queued" />, 'ar');
  expect(screen.getByRole('status').textContent).toContain('الطلب في قائمة الانتظار');
  mount(<AiProgress stage="running" />, 'ar');
  expect(screen.getByRole('status').textContent).toContain('الذكاء الاصطناعي يُعدّ اقتراحاتك');
});
