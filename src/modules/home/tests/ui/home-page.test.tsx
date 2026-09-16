// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastHost } from '@/ui/layout/toast/ToastHost';
// The page is exercised without its network layer: the query hook is the only seam, so each
// scenario supplies the aggregated payload directly. The translator echoes its key plus the count
// it was given, so a scenario can assert which fact a row chose to show.
const { query } = vi.hoisted(() => ({ query: { current: {} as HomeQuery } }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number | string; percent?: string }) =>
    values?.count === undefined
      ? values?.percent === undefined
        ? key
        : `${key}=${values.percent}`
      : `${key}=${values.count}`,
}));
vi.mock('@/ui/format', () => ({
  useCount: () => (value: number) => String(value),
  initials: (name: string) => name.slice(0, 2).toUpperCase(),
  usePlainDate: () => (value: string) => value,
  useWeekday: () => (value: string) => `weekday:${value}`,
  useDayOfMonth: () => (value: string) => value.slice(-2),
  useToday: () => '2026-09-14',
  useDecimal: () => (value: number) => String(value),
  usePercent: () => (value: number) => `${Math.round(value * 100)}%`,
  useSignedPercent: () => (value: number) => String(value),
  useMonth: () => (value: number) => String(value),
  useMonthYear: () => (year: number, month: number) => `${year}-${month}`,
  useYear: () => (value: number) => String(value),
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
  done: number | null;
  status: string | null;
  ratio: number | null;
};
type Day = { date: string; count: number };
type Section = {
  key: string;
  enabled: boolean;
  count: number;
  href: string | null;
  items: Item[];
  stale: number | null;
  days: Day[] | null;
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
  done: null,
  status: null,
  ratio: null,
  ...facts,
});
const section = (key: string, enabled: boolean, count = 0, items: Item[] = []): Section => ({
  key,
  enabled,
  count,
  href: enabled ? `/${key}` : null,
  items,
  stale: null,
  days: null,
});
const week = (counts: number[]) =>
  counts.map((count, index) => {
    const date = `2026-09-${String(14 + index).padStart(2, '0')}`;
    return { date, count, href: `/tasks?view=all&due=${date}` };
  });
// The completion control talks to the shared query client and reports itself through the shared
// toast viewport (TASKS-B02), so scenarios render inside both, the way the app mounts them.
const mount = (node: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ToastHost>{node}</ToastHost>
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
  // Both task counts are stated in the Actions header, so zero due today is still an answer.
  expect(screen.getByText('bandCount=2')).toBeTruthy();
  expect(screen.getByText('bandCount=0')).toBeTruthy();
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
  // The lateness warning stays in the overdue band; the headline states the day.
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('today_headline=4');
});
it('HOME-B07 falls back to the standing subtitle when the due-today section is not installed', () => {
  show([section('committees', true, 1, [item('Audit Committee', { count: 2 })])]);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('title');
});
it('HOME-B07 HOME-B14 the week leads on the raised surface whatever else the day holds', () => {
  const { container } = show([
    section('overdue', true, 3, [item('Late', { date: '2026-09-02' })]),
    { ...section('today', true, 2, [item('Due now')]), days: week([2, 0, 1, 0, 0, 4, 1]) },
    section('waiting', true, 1, [item('Held', { owner: 'Leila Haddad', count: 1 })]),
  ]);
  const panels = screen.getAllByRole('heading', { level: 2 });
  // The lead is fixed: the week, not whichever section happens to carry the most.
  expect(panels[0]?.textContent).toContain('week');
  expect(container.querySelector('.home-lead')?.textContent).toContain('week');
});
it('HOME-B14 draws the week as what is late and then the next seven days with their due counts', () => {
  const { container } = show([
    { ...section('overdue', true, 3, [item('Late', { date: '2026-09-02' })]), stale: 1 },
    { ...section('today', true, 2, [item('Due now')]), days: week([2, 0, 1, 0, 0, 4, 1]) },
  ]);
  const strip = within(container.querySelector('.home-lead') ?? container);
  const cells = strip.getAllByRole('listitem');
  expect(cells).toHaveLength(8);
  // The overdue cell first, carrying its count and the way into the view; the ageing split stays
  // in the Actions band, where there is room for the sentence.
  expect(cells[0]?.textContent).toContain('weekOverdue');
  expect(cells[0]?.textContent).toContain('3');
  expect(cells[0]?.textContent).not.toContain('staleOverdue');
  expect(
    within(cells[0] ?? container)
      .getByRole('link')
      .getAttribute('href'),
  ).toBe('/overdue');
  // Then the days, today first and marked as such, each with what falls due on it.
  expect(cells[1]?.getAttribute('aria-current')).toBe('date');
  expect(cells[1]?.textContent).toContain('weekday:2026-09-14');
  expect(cells[1]?.textContent).toContain('due=2');
  expect(cells[7]?.textContent).toContain('due=1');
  // Each day is somewhere to go: it opens the list narrowed to that day (HOME-B03, TASKS-B05).
  expect(
    within(cells[1] ?? container)
      .getByRole('link')
      .getAttribute('href'),
  ).toBe('/tasks?view=all&due=2026-09-14');
  // The heading sums the seven days, so the week reads as one figure before it reads as seven.
  expect(strip.getByRole('heading', { level: 2 }).textContent).toContain('weekDue=8');
});
it('HOME-B14 leaves the overdue cell out when the overdue section is not installed', () => {
  const { container } = show([{ ...section('today', true, 0), days: week([0, 0, 0, 0, 0, 0, 0]) }]);
  const strip = within(container.querySelector('.home-lead') ?? container);
  expect(strip.getAllByRole('listitem')).toHaveLength(7);
  expect(strip.queryByText('weekOverdue')).toBeNull();
});
it('HOME-B01 draws overdue and due today as one Actions block with two bands', () => {
  show([
    section('overdue', true, 1, [item('Late letter', { date: '2026-09-02' })]),
    section('today', true, 1, [item('Read the pack')]),
    section('committees', true, 1, [item('Audit Committee', { count: 3 })]),
  ]);
  const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
  expect(headings.some((text) => text?.includes('actions'))).toBe(true);
  // Neither task section is a heading of its own any more.
  expect(headings.some((text) => text === 'overdue' || text === 'today')).toBe(false);
  // The bands are labelled, and the block's way into the module is the today view.
  expect(screen.getByText('overdue')).toBeTruthy();
  expect(screen.getByText('today')).toBeTruthy();
  const links = screen.getAllByRole('link', { name: 'viewAll' });
  expect(links.map((link) => link.getAttribute('href'))).toContain('/today');
});
it('HOME-B01 does not draw a band that has nothing in it', () => {
  show([
    section('overdue', true, 0),
    section('today', true, 2, [item('Read the pack'), item('Sign the memo')]),
  ]);
  expect(screen.queryByText('overdue')).toBeNull();
  expect(screen.getByText('today')).toBeTruthy();
});
it('HOME-B01 shows how late an overdue row is and what a committee carries', () => {
  show([
    section('overdue', true, 1, [item('Late letter', { date: '2026-09-02' })]),
    section('committees', true, 1, [item('Audit Committee', { count: 3 })]),
  ]);
  expect(screen.getByText('daysLate=12')).toBeTruthy();
  expect(screen.getByText('openWork=3')).toBeTruthy();
});
it('HOME-B01 draws a KPI row as its arc, its share of the target and its state word', () => {
  const { container } = show([
    section('kpis', true, 2, [
      item('Strategic budget committed', {
        committee: 'Deliver the strategy',
        status: 'off_target',
        ratio: 0.48,
      }),
      item('Regional coverage', { status: 'stale', ratio: null }),
    ]),
  ]);
  expect(screen.getByText('ofTarget=48%')).toBeTruthy();
  expect(screen.getByText('off_target')).toBeTruthy();
  // The objective is not repeated on the row; the scorecard groups by it already.
  expect(screen.queryByText('Deliver the strategy')).toBeNull();
  // A measure with no proportion still names its state, and its arc stays an empty track.
  expect(screen.getByText('stale')).toBeTruthy();
  expect(screen.queryByText('ofTarget=null')).toBeNull();
  expect(container.querySelectorAll('.meter-arc')).toHaveLength(1);
});
it('HOME-B10 makes waiting a chase list: one row per person with how much they hold and when the earliest is due', () => {
  show([
    section('waiting', true, 4, [
      item('Leila Haddad', { owner: 'Leila Haddad', count: 3, date: '2026-09-20', overdue: 2 }),
      item('Omar Nasser', { owner: 'Omar Nasser', count: 1, overdue: 0 }),
    ]),
  ]);
  expect(screen.getByText('holding=3')).toBeTruthy();
  expect(screen.getByText('holding=1')).toBeTruthy();
  expect(screen.getByText('earliestDue')).toBeTruthy();
  // How much of what a holder has is already late, said once and only above zero.
  expect(screen.getByText('lateOpen=2')).toBeTruthy();
  expect(screen.queryByText('lateOpen=0')).toBeNull();
});
it('HOME-B10 names the unassigned row in the chase list and gives it no face', () => {
  show([
    section('waiting', true, 3, [
      item('Leila Haddad', { owner: 'Leila Haddad', count: 1 }),
      item('', { id: 'unassigned', owner: null, count: 2, date: '2026-09-20' }),
    ]),
  ]);
  expect(screen.getByText('unassigned')).toBeTruthy();
  expect(screen.getByTitle('unassigned')).toBeTruthy();
  expect(screen.getByText('holding=2')).toBeTruthy();
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
      <ToastHost>
        <HomePage />
      </ToastHost>
    </QueryClientProvider>
  );
  const view = render(tree());
  const before = screen.getByText('bandCount=2');
  expect(before.className).toContain('count-tick');
  query.current = data(1);
  view.rerender(tree());
  expect(screen.getByText('bandCount=1')).not.toBe(before);
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
    { ...section('today', true, 1, [item('Due now')]), days: week([1, 0, 0, 0, 0, 0, 0]) },
    section('waiting', true, 1, [item('Leila Haddad', { owner: 'Leila Haddad', count: 2 })]),
    section('committees', true, 1, [item('Audit Committee', { count: 3, overdue: 2 })]),
    section('notes', true, 1, [item('Weekly briefing', { date: '2026-09-13' })]),
  ]);
  // The day leads, and the week block rises with its cells behind it.
  expect(container.querySelector('header')?.className).toContain('home-rise');
  const lead = container.querySelector('.home-lead');
  expect(lead?.className).toContain('home-rise');
  expect(lead?.querySelector('.home-lead-rows')).toBeTruthy();
  // Only the lead cascades its rows: a second list of them would make the page a ticker.
  expect(container.querySelectorAll('.home-lead-rows')).toHaveLength(1);
  // The sections below are staggered by their position inside the one grid they share.
  const grid = container.querySelectorAll('.home-column');
  expect(grid).toHaveLength(1);
  expect(grid[0]?.children.length).toBe(4);
  // A mark draws itself rather than appearing filled.
  expect(container.querySelectorAll('.meter-fill').length).toBeGreaterThan(0);
});
it('HOME-B07 orders the grid as the principal asks: actions, waiting, KPIs, then the rest', () => {
  show([
    section('notes', true, 1, [item('Weekly briefing', { date: '2026-09-13' })]),
    section('kpis', true, 1, [item('Coverage', { status: 'off_target', ratio: 0.5 })]),
    section('committees', true, 1, [item('Audit Committee', { count: 3 })]),
    section('waiting', true, 1, [item('Leila Haddad', { owner: 'Leila Haddad', count: 2 })]),
    section('overdue', true, 1, [item('Late letter', { date: '2026-09-02' })]),
    section('today', true, 0),
  ]);
  // The payload's order is the product's urgency order for ownership; the grid has its own.
  const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
  // The week's own heading comes first; the grid starts after it.
  expect(headings.slice(1, 5)).toEqual(['actions', 'waiting', 'kpis', 'committees']);
  expect(headings.at(-1)).toBe('notes');
});
it('HOME-B08 offers a completion control on task rows and nothing to complete elsewhere', () => {
  show([
    section('today', true, 1, [item('Approve the catalogue', { revision: 3 })]),
    section('committees', true, 1, [item('Audit Committee', { count: 2 })]),
  ]);
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
});

it('HOME-B05 the line under the headline is a ledger of the sections, each count a way in', () => {
  show([
    section('overdue', true, 2, [item('Late', { date: '2026-09-02' })]),
    section('today', true, 0),
    section('waiting', true, 3, [item('Leila Haddad', { owner: 'Leila Haddad', count: 3 })]),
    section('kpis', true, 0),
    section('committees', true, 1, [item('Audit Committee', { count: 3 })]),
  ]);
  // In section order, each a link to its section; zero is stated rather than dropped.
  const ledger = ['ledger_overdue=2', 'ledger_waiting=3', 'ledger_kpis=0', 'ledger_committees=1'];
  for (const entry of ledger) expect(screen.getByRole('link', { name: entry })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'ledger_overdue=2' }).getAttribute('href')).toBe(
    '/overdue',
  );
  // The greeting that repeated the rail foot is gone; the principal line stays when it differs.
  expect(screen.queryByText('greeting')).toBeNull();
});
it('HOME-B07 only the summaries wear the danger ink; a row states its lateness in muted figures', () => {
  show([section('overdue', true, 1, [item('Late letter', { date: '2026-09-02' })])]);
  expect(screen.getByText('daysLate=12').className).not.toContain('text-danger');
  expect(screen.getByRole('link', { name: 'ledger_overdue=1' }).className).toContain('text-danger');
});
it('HOME-B02 an empty section answers its own question where it has one', () => {
  show([
    section('waiting', true, 0),
    section('committees', true, 0),
    section('kpis', true, 0),
    section('notes', true, 0),
    section('overdue', true, 0),
    section('today', true, 0),
  ]);
  for (const key of ['emptyWaiting', 'emptyCommittees', 'emptyKpis', 'emptyNotes', 'emptyActions'])
    expect(screen.getByText(key)).toBeTruthy();
  expect(screen.queryByText('empty')).toBeNull();
});
it('HOME-B01 recent notes are drawn as cards and take the spare columns', () => {
  const { container } = show([
    section('notes', true, 2, [
      item('Weekly briefing', { date: '2026-09-13' }),
      item('Board prep', { date: '2026-09-12' }),
    ]),
  ]);
  const wide = container.querySelector('.home-column > .lg\\:col-span-2');
  expect(wide?.textContent).toContain('notes');
  expect(wide?.querySelectorAll('a').length).toBe(3);
});
it('HOME-B14 the cells fall silent when the heading has already said nothing is due', () => {
  const { container } = show([{ ...section('today', true, 0), days: week([0, 0, 0, 0, 0, 0, 0]) }]);
  const strip = within(container.querySelector('.home-lead') ?? container);
  expect(strip.getByRole('heading', { level: 2 }).textContent).toContain('weekDue=0');
  expect(strip.queryByText('due=0')).toBeNull();
});
it('HOME-B01 a KPI without a reading says so instead of showing an empty proportion', () => {
  show([
    section('kpis', true, 1, [item('Partner satisfaction', { status: 'no_data', ratio: null })]),
  ]);
  expect(screen.getByText('noReading')).toBeTruthy();
  expect(screen.getByText('no_data')).toBeTruthy();
});
