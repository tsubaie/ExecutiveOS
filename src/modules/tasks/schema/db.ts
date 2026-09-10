import 'server-only';
import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  index,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '@/core/db/system-schema';
import { people } from '@/modules/people/schema/db';
import { notes } from '@/modules/notes/schema/db';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const tasks = pgTable(
  'tasks',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull().default(1),
    title: text().notNull(),
    description: text(),
    status: text().notNull().default('inbox'),
    priority: text(),
    dueDate: date('due_date'),
    completedAt: time('completed_at'),
    ownerId: uuid('owner_id').references(() => people.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => tasks.id, { onDelete: 'set null' }),
    sourceNoteId: uuid('source_note_id').references(() => notes.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
    searchText: text('search_text').generatedAlwaysAs(
      sql`eos_normalize(title || ' ' || coalesce(description, ''))`,
    ),
  },
  (t) => [
    index('tasks_owner_idx').on(t.ownerId),
    index('tasks_parent_idx').on(t.parentId),
    index('tasks_source_note_idx').on(t.sourceNoteId),
    index('tasks_creator_idx').on(t.createdBy),
    index('tasks_updater_idx').on(t.updatedBy),
    index('tasks_due_idx').on(t.dueDate, t.id),
    index('tasks_status_idx').on(t.status, t.deletedAt),
    index('tasks_search_idx').using('gin', t.searchText.op('gin_trgm_ops')),
    check('tasks_title_check', sql`length(trim(${t.title})) between 1 and 500`),
    check(
      'tasks_status_check',
      sql`${t.status} in ('inbox','next_action','waiting_on','someday','completed')`,
    ),
    check('tasks_priority_check', sql`${t.priority} in ('low','medium','high','urgent')`),
    check(
      'tasks_completed_check',
      sql`(${t.status} = 'completed') = (${t.completedAt} is not null)`,
    ),
    check('tasks_self_check', sql`${t.parentId} <> ${t.id}`),
  ],
);
