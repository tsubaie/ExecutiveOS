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
  primaryKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { committees } from '@/modules/committees/schema/db';
import { users } from '@/core/db/system-schema';
import { people } from '@/modules/people/schema/db';
import { notes } from '@/modules/notes/schema/db';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const tasks = pgTable(
  'tasks',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull().default(1),
    committeeId: uuid('committee_id').references(() => committees.id, { onDelete: 'set null' }),
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
    index('tasks_committee_idx').on(t.committeeId),
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

// TASKS-B02: completing a parent with open subtasks changes several rows at once, so a completion
// is recorded as one operation with one identity. Undo needs each row's state from before, which
// nothing else stores: the audit log holds the patch that was applied, not what it replaced, and it
// is write-only infrastructure with untyped JSON rather than a place to read domain state back out
// of. Two small typed tables make ownership, idempotency and concurrency explicit instead.
export const taskCompletions = pgTable(
  'task_completions',
  {
    id: uuid().primaryKey(),
    rootTaskId: uuid('root_task_id')
      .notNull()
      .references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id),
    status: text().notNull().default('completed'),
    createdAt: time('created_at').notNull().defaultNow(),
    undoneAt: time('undone_at'),
  },
  (t) => [
    index('task_completions_root_idx').on(t.rootTaskId),
    index('task_completions_actor_idx').on(t.actorId),
    check('task_completions_status_check', sql`${t.status} in ('completed','undone')`),
    check(
      'task_completions_undone_check',
      sql`(${t.status} = 'undone') = (${t.undoneAt} is not null)`,
    ),
  ],
);
// One row per task the operation actually changed. A subtask that was already completed is not an
// item, so Undo leaves it completed. `completed_revision` is the revision the row carried once this
// operation had completed it, and it is the per-row fence Undo checks: if anything has touched the
// row since, the operation is refused rather than overwriting later work.
export const taskCompletionItems = pgTable(
  'task_completion_items',
  {
    completionId: uuid('completion_id')
      .notNull()
      .references(() => taskCompletions.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
    previousStatus: text('previous_status').notNull(),
    previousCompletedAt: time('previous_completed_at'),
    completedRevision: integer('completed_revision').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.completionId, t.taskId] }),
    index('task_completion_items_task_idx').on(t.taskId),
    check(
      'task_completion_items_status_check',
      sql`${t.previousStatus} in ('inbox','next_action','waiting_on','someday','completed')`,
    ),
  ],
);
