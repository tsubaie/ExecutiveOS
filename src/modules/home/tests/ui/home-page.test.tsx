// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
// The page is exercised without its network layer: the query hook is the only seam, so each
// scenario supplies the aggregated payload directly.
type HomeQuery = {
  isPending: boolean;
  error: Error | null;
  data?: {
    data: { name: string; principal: string | null; peopleCount: number; sections: Section[] };
  };
};
const { query } = vi.hoisted(() => ({ query: { current: {} as HomeQuery } }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/ui/format', () => ({ useCount: () => (value: number) => String(value) }));
vi.mock('../../ui/queries', () => ({ useHome: () => query.current }));
import { HomePage } from '../../ui/HomePage';
type Section = {
  key: string;
  enabled: boolean;
  count: number;
  href: string | null;
  items: { id: string; title: string; href: string }[];
};
const section = (key: string, enabled: boolean, count = 0, items: Section['items'] = []) => ({
  key,
  enabled,
  count,
  href: enabled ? `/${key}` : null,
  items,
});
function show(sections: Section[]) {
  query.current = {
    isPending: false,
    error: null,
    data: { data: { name: 'Preview Administrator', principal: null, peopleCount: 4, sections } },
  };
  return render(<HomePage />);
}
afterEach(() => cleanup());
it('HOME-B02 omits sections whose module is not installed and keeps an installed section at zero', () => {
  show([
    section('overdue', true, 2, [
      { id: '01a08a9f-1991-760a-b73a-568f6f86653b', title: 'Overdue report', href: '/tasks/1' },
    ]),
    section('today', true, 0),
    section('nextMeetings', false),
    section('kpis', false),
  ]);
  expect(screen.getByText('overdue')).toBeTruthy();
  // Zero is an answer, so the installed section keeps its line.
  expect(screen.getByText('today')).toBeTruthy();
  expect(screen.queryByText('nextMeetings')).toBeNull();
  expect(screen.queryByText('kpis')).toBeNull();
  expect(screen.queryByText('disabled')).toBeNull();
  expect(screen.queryByText('empty')).toBeNull();
});
it('HOME-B02 shows one empty state instead of an empty box when no module is installed', () => {
  show([section('nextMeetings', false), section('kpis', false), section('initiatives', false)]);
  expect(screen.getByText('empty')).toBeTruthy();
  expect(screen.getByText('emptyHint')).toBeTruthy();
  expect(screen.queryByText('nextMeetings')).toBeNull();
});
it('HOME-B01 gives every item its own reachable title so a truncated row stays identifiable', () => {
  show([
    section('committees', true, 1, [
      {
        id: '01a09ec1-bcde-7715-bec0-f0c3ae4dbd28',
        title: 'A committee name long enough to be truncated in the row',
        href: '/committees?view=all&id=1',
      },
    ]),
  ]);
  const link = screen.getByTitle('A committee name long enough to be truncated in the row');
  expect(link.getAttribute('href')).toBe('/committees?view=all&id=1');
});
it('HOME-B04 renders a shaped skeleton rather than collapsing the layout while loading', () => {
  query.current = { isPending: true, error: null };
  render(<HomePage />);
  expect(screen.getByRole('status')).toBeTruthy();
  expect(screen.queryByText('greeting')).toBeNull();
});
