// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  initials: (name: string) => name.slice(0, 2).toUpperCase(),
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
  revision: number | null;
  overdue: number | null;
};
type Section = {
  key: string;
  enabled: boolean;
  count: number;
  href: string | null;
  items: Item[];
  stale: number | null;
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
  revision: null,
  overdue: null,
  ...facts,
});
const section = (key: string, enabled: boolean, count = 0, items: Item[] = []): Section => ({
  key,
  enabled,
  count,
  href: enabled ? `/${key}` : null,
  items,
  stale: null,
});
// The completion control talks to the shared query client, so scenarios render inside one.
const mount = (node: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {node}
    </QueryClientProvider>,
  );
function show(sections: Section[]) {
  query.current = {
    isPending: false,
    error: null,
    data: { data: { name: 'Preview Administrator', principal: null, peopleCount: 4, sections } },
  };
  return mount(<HomePage />);
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
it('HOME-B07 opens on the day ahead rather than on how far behind the principal is', () => {
  show([
    section('overdue', true, 2, [item('Late', { date: '2026-09-02' })]),
    section('today', true, 4, [item('Due now')]),
  ]);
  // The lateness warning stays in the overdue block; the headline states the day.
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('today_headline=4');
});
it('HOME-B07 falls back to the standing subtitle when the due-today section is not installed', () => {
  show([section('committees', true, 1, [item('Audit Committee', { count: 2 })])]);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('title');
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
it('HOME-B01 shows how late an overdue row is and what a committee carries', () => {
  show([
    section('overdue', true, 1, [item('Late letter', { date: '2026-09-02' })]),
    section('committees', true, 1, [item('Audit Committee', { count: 3 })]),
  ]);
  expect(screen.getByText('daysLate=12')).toBeTruthy();
  expect(screen.getByText('openWork=3')).toBeTruthy();
});
it('HOME-B10 makes waiting a chase list: one row per person with how much they hold', () => {
  show([
    section('waiting', true, 4, [
      item('Leila Haddad', { owner: 'Leila Haddad', count: 3 }),
      item('Omar Nasser', { owner: 'Omar Nasser', count: 1 }),
    ]),
  ]);
  expect(screen.getByText('holding=3')).toBeTruthy();
  expect(screen.getByText('holding=1')).toBeTruthy();
});
it('HOME-B09 states how much of the overdue pile is a month or more old', () => {
  show([{ ...section('overdue', true, 5, [item('Late', { date: '2026-09-02' })]), stale: 2 }]);
  expect(screen.getByText('staleOverdue=2')).toBeTruthy();
});
it('HOME-B09 says nothing about ageing when nothing has aged', () => {
  show([{ ...section('overdue', true, 5, [item('Late', { date: '2026-09-02' })]), stale: 0 }]);
  // An all-neutral mark carries no information, so the line is dropped rather than drawn empty.
  expect(screen.queryByText('staleOverdue=0')).toBeNull();
});
it("HOME-B09 shows a committee's late share beside its open work", () => {
  show([section('committees', true, 1, [item('Audit', { count: 4, overdue: 2 })])]);
  expect(screen.getByText('lateOpen=2')).toBeTruthy();
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
  mount(<HomePage />);
  expect(screen.getByRole('status')).toBeTruthy();
  expect(screen.queryByText('greeting')).toBeNull();
});
it('HOME-B08 a count that changes is replaced rather than swapped in silence', () => {
  // The figure is keyed on its own value, so a change remounts it and the stylesheet plays the
  // replacement. Identity across the rerender is the observable half of that.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const data = (count: number) => ({
    isPending: false as const,
    error: null,
    data: {
      data: {
        name: 'Preview Administrator',
        principal: null,
        peopleCount: 4,
        sections: [section('today', true, count, [item('Approve the catalogue', { revision: 3 })])],
      },
    },
  });
  query.current = data(2);
  // A fresh element each time: React bails out of re-rendering one it is handed back by identity.
  const tree = () => (
    <QueryClientProvider client={client}>
      <HomePage />
    </QueryClientProvider>
  );
  const view = render(tree());
  const before = screen.getByText('2');
  expect(before.className).toContain('count-tick');
  query.current = data(1);
  view.rerender(tree());
  expect(screen.getByText('1')).not.toBe(before);
});
it('HOME-B12 hands every block that arrives the entrance, in reading order', () => {
  // The delays are CSS steps keyed off each block's position, so what the page has to get right is
  // which elements are in the cascade and which container they sit in. jsdom applies no stylesheet,
  // so the hooks are what is asserted; the resting state and the reduced-motion rule are CSS.
  const { container } = show([
    section('overdue', true, 2, [
      item('Late letter', { date: '2026-09-02' }),
      item('Late report', { date: '2026-09-03' }),
    ]),
    section('waiting', true, 1, [item('Leila Haddad', { owner: 'Leila Haddad', count: 2 })]),
    section('committees', true, 1, [item('Audit Committee', { count: 3, overdue: 2 })]),
    section('notes', true, 1, [item('Weekly briefing', { date: '2026-09-13' })]),
  ]);
  // The day leads, and the lead block rises with its rows behind it.
  expect(container.querySelector('header')?.className).toContain('home-rise');
  const lead = container.querySelector('.home-lead');
  expect(lead?.className).toContain('home-rise');
  expect(lead?.querySelector('.home-lead-rows')).toBeTruthy();
  // Only the lead cascades its rows: a second list of them would make the page a ticker.
  expect(container.querySelectorAll('.home-lead-rows')).toHaveLength(1);
  // The sections below are staggered by their position inside their own column, and the column
  // holding reference material is marked so it settles after the one beside it.
  expect(container.querySelectorAll('.home-column')).toHaveLength(2);
  expect(container.querySelector('.home-column-quiet')?.textContent).toContain('notes');
  // A mark draws itself rather than appearing filled.
  expect(container.querySelectorAll('.meter-fill').length).toBeGreaterThan(0);
});
it('HOME-B08 offers a completion control on task rows and nothing to complete elsewhere', () => {
  show([
    section('today', true, 1, [item('Approve the catalogue', { revision: 3 })]),
    section('committees', true, 1, [item('Audit Committee', { count: 2 })]),
  ]);
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
});
