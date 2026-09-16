import { plainDateValue } from '@/ui/format';
// Shape of one aggregated section as the page consumes it (HOME-B01), plus the judgements the
// page makes about a section: which block it belongs to, and whether it is a problem.
export type SectionKey =
  | 'nextMeetings'
  | 'prep'
  | 'overdue'
  | 'today'
  | 'waiting'
  | 'committees'
  | 'kpis'
  | 'initiatives'
  | 'notes';
export type Item = {
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
export type Day = { date: string; count: number; href: string };
export type Section = {
  key: SectionKey;
  enabled: boolean;
  count: number;
  href: string | null;
  items: Item[];
  stale: number | null;
  days: Day[] | null;
};
export const daysBetween = (from: string, to: string) =>
  Math.round((plainDateValue(to).getTime() - plainDateValue(from).getTime()) / 86400000);
// Overdue is the only state on this page that means something has gone wrong, so it is the only one
// allowed to borrow the danger token. Every other reading stays in the neutral scale.
export const alarming = (section: Section) => section.key === 'overdue' && section.count > 0;

// HOME-B01: the two task sections answer one question — what do I have to do — and are one view
// in Tasks, so the page draws them as one block with two bands rather than two sections.
const actionKeys: readonly SectionKey[] = ['overdue', 'today'];
export const isAction = (section: Section) => actionKeys.includes(section.key);
// HOME-B07: under the week the sections sit in one grid of three columns, in the order the
// principal asks: what must I do (actions), who do I chase (waiting), what moved (KPIs), then the
// bodies carrying work, the programmes slipping, and last their own recent writing, which is
// reference rather than a state to read and is drawn quieter for it.
const gridOrder: readonly SectionKey[] = [
  'waiting',
  'kpis',
  'committees',
  'initiatives',
  'notes',
  'nextMeetings',
  'prep',
];
export const gridRank = (section: Section) => gridOrder.indexOf(section.key);
const quietKeys: readonly SectionKey[] = ['notes'];
export const quiet = (section: Section) => quietKeys.includes(section.key);
// HOME-B01: reference material takes the grid's spare columns and is drawn as cards.
export const wide = (section: Section) => section.key === 'notes';
// HOME-B02: the sections that have a sentence of their own for having nothing in them.
const emptyKeys: Partial<
  Record<SectionKey, 'emptyWaiting' | 'emptyCommittees' | 'emptyKpis' | 'emptyNotes'>
> = {
  waiting: 'emptyWaiting',
  committees: 'emptyCommittees',
  kpis: 'emptyKpis',
  notes: 'emptyNotes',
};
export const emptyKey = (key: SectionKey) => emptyKeys[key] ?? null;
