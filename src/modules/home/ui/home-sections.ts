import { plainDateValue } from '@/ui/format';
// Shape of one aggregated section as the page consumes it (HOME-B01), plus the two judgements the
// page makes about a section: what to call it in the stat band, and whether it is a problem.
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
};
export type Section = {
  key: SectionKey;
  enabled: boolean;
  count: number;
  href: string | null;
  items: Item[];
  stale: number | null;
};
export type StatKey =
  | 'statNextMeetings'
  | 'statPrep'
  | 'statOverdue'
  | 'statToday'
  | 'statWaiting'
  | 'statCommittees'
  | 'statKpis'
  | 'statInitiatives'
  | 'statNotes';
export const statLabel: Record<SectionKey, StatKey> = {
  nextMeetings: 'statNextMeetings',
  prep: 'statPrep',
  overdue: 'statOverdue',
  today: 'statToday',
  waiting: 'statWaiting',
  committees: 'statCommittees',
  kpis: 'statKpis',
  initiatives: 'statInitiatives',
  notes: 'statNotes',
};
export const daysBetween = (from: string, to: string) =>
  Math.round((plainDateValue(to).getTime() - plainDateValue(from).getTime()) / 86400000);
// Overdue is the only state on this page that means something has gone wrong, so it is the only one
// allowed to borrow the danger token. Every other reading stays in the neutral scale.
export const alarming = (section: Section) => section.key === 'overdue' && section.count > 0;

// HOME-B07: the sections below the lead are not equals. What the principal is accountable for today
// carries the page; a log of what they already wrote is reference material and sits in a narrower,
// quieter column rather than competing for the same weight.
const ambientKeys: readonly SectionKey[] = ['notes'];
export const ambient = (section: Section) => ambientKeys.includes(section.key);
