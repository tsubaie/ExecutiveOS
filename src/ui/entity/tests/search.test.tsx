// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EntitySearch } from '../EntitySearch';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('EP-B22 a delayed search URL update preserves characters typed since submission', () => {
  vi.useFakeTimers();
  const navigate = vi.fn();
  const view = render(<EntitySearch query="" navigate={navigate} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Note' } });
  act(() => vi.advanceTimersByTime(250));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Notes today' } });
  view.rerender(<EntitySearch query="Note" navigate={navigate} />);
  expect(screen.getByRole('textbox')).toHaveProperty('value', 'Notes today');
  act(() => vi.advanceTimersByTime(250));
  expect(navigate).toHaveBeenLastCalledWith({ q: 'Notes today' }, true);
});
it('EP-B15 clearing a committed search does not resurrect the original draft', () => {
  vi.useFakeTimers();
  const navigate = vi.fn();
  const view = render(<EntitySearch query="" navigate={navigate} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Notes' } });
  act(() => vi.advanceTimersByTime(250));
  expect(navigate).toHaveBeenCalledWith({ q: 'Notes' }, true);
  view.rerender(<EntitySearch query="Notes" navigate={navigate} />);
  view.rerender(<EntitySearch query="" navigate={navigate} />);
  navigate.mockClear();
  expect(screen.getByRole('textbox')).toHaveProperty('value', '');
  act(() => vi.advanceTimersByTime(1000));
  expect(navigate).not.toHaveBeenCalled();
});
it('EP-B15 resetting search cancels a draft before its debounce finishes', () => {
  vi.useFakeTimers();
  const navigate = vi.fn();
  const view = render(<EntitySearch key={0} query="" navigate={navigate} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Notes' } });
  view.rerender(<EntitySearch key={1} query="" navigate={navigate} />);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('textbox')).toHaveProperty('value', '');
  expect(navigate).not.toHaveBeenCalled();
});
