/** HOME-B01, B03, B09, B10, B14: the tasks module's Home provider, in one query. */
import 'server-only';
import { z } from 'zod';
import type { Context } from '@/core/auth/session';
import { routes } from '@/core/routes';
import type { HomeSection } from '@/core/modules/server-manifest';
import * as repo from './repo';
type Row = Awaited<ReturnType<typeof repo.selectHomeSummary>>;
const TaskRows = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    revision: z.number(),
    date: z.string().nullable(),
    owner: z.string().nullable(),
    committee: z.string().nullable(),
  }),
);
const Holders = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    count: z.number(),
    date: z.string().nullable(),
    overdue: z.number(),
  }),
);
// Registered on the manifest (HOME-B03); the page consumes it through core/modules/registry.
export async function homeSummary(ctx: Context, today: string): Promise<HomeSection[]> {
  const row = await repo.selectHomeSummary(ctx.db, today);
  return [...taskSections(row), waitingSection(row)];
}
// Overdue and due today, each with its rows; the ageing split rides the overdue section (HOME-B09)
// and the week's shape rides the due-today one (HOME-B14), because both say what a pile looks like.
function taskSections(row: Row): HomeSection[] {
  // HOME-B03: each day carries its own way into the list, narrowed to that day (TASKS-B05).
  const days = z
    .array(z.object({ date: z.iso.date(), count: z.number() }))
    .parse(row['weekDays'])
    .map((day) => ({ ...day, href: routes.tasks({ view: 'all', due: day.date }) }));
  return ['overdue', 'today'].map((key) => ({
    key,
    enabled: true,
    count: z.number().parse(row[key + 'Count']),
    href: routes.tasks({ view: key }),
    stale: key === 'overdue' ? z.number().parse(row['overdueStale']) : null,
    days: key === 'today' ? days : null,
    items: TaskRows.parse(row[key + 'Items']).map((item) => ({
      ...item,
      href: routes.tasks({ view: 'all', id: item.id }),
    })),
  }));
}
// HOME-B10: one row per person holding work, dated by the earliest thing they hold and saying how
// much of it is already late. Waiting work with no owner is one last row, unnamed so the page can
// call it what it likes, opening the waiting view unfiltered: nobody to chase, but still waiting.
function waitingSection(row: Row): HomeSection {
  const unowned = z.number().parse(row['waitingUnowned']);
  const unownedRow = {
    id: 'unassigned',
    title: '',
    owner: null,
    count: unowned,
    date: z.string().nullable().parse(row['waitingUnownedDate']),
    overdue: z.number().parse(row['waitingUnownedLate']),
    href: routes.tasks({ view: 'waiting' }),
  };
  return {
    key: 'waiting',
    enabled: true,
    count: z.number().parse(row['waitingCount']),
    href: routes.tasks({ view: 'waiting' }),
    items: [
      ...Holders.parse(row['waitingPeople']).map((holder) => ({
        ...holder,
        owner: holder.title,
        href: routes.tasks({ view: 'waiting', ownerId: holder.id }),
      })),
      ...(unowned > 0 ? [unownedRow] : []),
    ],
  };
}
