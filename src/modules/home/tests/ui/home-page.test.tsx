// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
// The page is exercised without its network layer: the query hook is the only seam, so each
// scenario supplies the aggregated payload directly. The translator echoes its key plus the count
// it was given, so a scenario can assert which fact a row chose to show.
const { query } = vi.hoisted(() => ({ query: { current: {} as HomeQuery } }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? key : `${key}=${values.count}`,
}));
vi.mock('@/ui/format', () => ({
  useCount: () => (value: number) => String(value),
  usePlainDate: () => (value: string) => value,
  useToday: () => '2026-09-14',
  plainDateValue: (day: string) => {
    const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, date));
  },
}));
vi.mock('../../ui/queries', () => ({ useHome: () => query.current }));
import { HomePage } from '../../ui/HomePage';
type Item = {
  id: string;
  title: string;
  href: string;
  date: string | null;
  owner: string | null;
  committee: string | null;
  count: number | null;
};
type Section = {
  key: string;
  enabled: boolean;
  count: number;
  href: string | null;
  items: Item[];
};
type HomeQuery = {
  isPending: boolean;
  error: Error | null;
  data?: {
    data: { name: string; principal: string | null; peopleCount: number; sections: Section[] };
  };
};
let seq = 0;
const item = (title: string, facts: Partial<Item> = {}): Item => ({
  id: `01a09ec1-bcde-7715-bec0-f0c3ae4dbd${String(seq++).padStart(2, '0')}`,
  title,
  href: `/open/${seq}`,
  date: null,
  owner: null,
  committee: null,
  count: null,
  ...facts,
});
const section = (key: string, enabled: boolean, count = 0, items: Item[] = []): Section => ({
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
    section('overdue', true, 2, [item('Overdue report', { date: '2026-09-02' })]),
    section('today', true, 0),
    section('nextMeetings', false),
    section('kpis', false),
  ]);
  expect(screen.getByText('overdue')).toBeTruthy();
  // Zero is an answer, so the installed section keeps its panel.
  expect(screen.getByText('today')).toBeTruthy();
  expect(screen.queryByText('nextMeetings')).toBeNull();
  expect(screen.queryByText('kpis')).toBeNull();
  // `emptyHint` belongs only to the page-level empty state; a zero-item panel says "no results".
  expect(screen.queryByText('emptyHint')).toBeNull();
});
it('HOME-B02 shows one empty state instead of an empty box when no module is installed', () => {
  show([section('nextMeetings', false), section('kpis', false), section('initiatives', false)]);
  expect(screen.getByText('empty')).toBeTruthy();
  expect(screen.getByText('emptyHint')).toBeTruthy();
});
it('HOME-B01 counts every installed section in the stat strip, including the ones at zero', () => {
  show([
    section('overdue', true, 2, [item('Late', { date: '2026-09-02' })]),
    section('today', true, 0),
    section('waiting', true, 5, [item('Held', { owner: 'Leila Haddad' })]),
  ]);
  expect(screen.getByText('statOverdue')).toBeTruthy();
  expect(screen.getByText('statToday')).toBeTruthy();
  expect(screen.getByText('statWaiting')).toBeTruthy();
  expect(screen.getByText('statPeople')).toBeTruthy();
});
it('HOME-B07 leads with the first section that actually has something in it', () => {
  show([
    section('overdue', true, 0),
    section('today', true, 2, [item('Due now')]),
    section('waiting', true, 1, [item('Held', { owner: 'Leila Haddad' })]),
  ]);
  const panels = screen.getAllByRole('heading', { level: 2 });
  // An empty overdue section still gets a panel, but it does not take the lead slot.
  expect(panels[0]?.textContent).toBe('today');
});
it('HOME-B01 shows how late an overdue row is, who holds a waiting row, and what a committee carries', () => {
  show([
    section('overdue', true, 1, [item('Late letter', { date: '2026-09-02' })]),
    section('waiting', true, 1, [item('Held', { owner: 'Leila Haddad' })]),
    section('committees', true, 1, [item('Audit Committee', { count: 3 })]),
  ]);
  expect(screen.getByText('daysLate=12')).toBeTruthy();
  expect(screen.getByText('Leila Haddad')).toBeTruthy();
  expect(screen.getByText('openWork=3')).toBeTruthy();
});
it('HOME-B01 keeps a truncated row identifiable through its title attribute', () => {
  show([
    section('committees', true, 1, [
      item('A committee name long enough to be truncated in the row', { count: 1 }),
    ]),
  ]);
  expect(screen.getByTitle('A committee name long enough to be truncated in the row')).toBeTruthy();
});
it('HOME-B04 renders a shaped skeleton rather than collapsing the layout while loading', () => {
  query.current = { isPending: true, error: null };
  render(<HomePage />);
  expect(screen.getByRole('status')).toBeTruthy();
  expect(screen.queryByText('greeting')).toBeNull();
});
