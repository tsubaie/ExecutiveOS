import 'server-only';
import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  index,
  uniqueIndex,
  check,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { committees } from '@/modules/committees/schema/db';
import { users, jobs } from '@/core/db/system-schema';
import { people } from '@/modules/people/schema/db';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const notes = pgTable(
  'notes',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull().default(1),
    committeeId: uuid('committee_id').references(() => committees.id, { onDelete: 'set null' }),
    title: text().notNull(),
    content: text().notNull().default(''),
    type: text(),
    noteDate: date('note_date').notNull(),
    tags: text().array().notNull().default([]),
    archivedAt: time('archived_at'),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
    searchText: text('search_text').generatedAlwaysAs(sql`eos_normalize(title || ' ' || content)`),
  },
  (t) => [
    index('notes_committee_idx').on(t.committeeId),
    index('notes_date_idx')
      .on(t.noteDate, t.createdAt, t.id)
      .where(sql`${t.deletedAt} is null`),
    index('notes_type_idx').on(t.type),
    index('notes_archived_idx').on(t.archivedAt),
    index('notes_creator_idx').on(t.createdBy),
    index('notes_updater_idx').on(t.updatedBy),
    index('notes_tags_idx').using('gin', t.tags),
    index('notes_search_idx').using('gin', t.searchText.op('gin_trgm_ops')),
    check('notes_title_check', sql`length(trim(${t.title})) between 1 and 500`),
    check('notes_tags_check', sql`cardinality(${t.tags}) <= 10`),
  ],
);
// Participants (NOTES-I04): soft-deleted on removal so the audit trail keeps who was involved.
export const notePeople = pgTable(
  'note_people',
  {
    id: uuid().primaryKey(),
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    createdAt: time('created_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
  },
  (t) => [
    uniqueIndex('note_people_active_idx')
      .on(t.noteId, t.personId)
      .where(sql`${t.deletedAt} is null`),
    index('note_people_note_idx').on(t.noteId),
    index('note_people_person_idx').on(t.personId),
    index('note_people_creator_idx').on(t.createdBy),
  ],
);

export const noteRefinements = pgTable(
  'note_refinements',
  {
    id: uuid().primaryKey(),
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id),
    noteRevision: integer('note_revision').notNull(),
    contentHash: text('content_hash').notNull(),
    capabilityVersion: integer('capability_version').notNull(),
    refinedContent: text('refined_content').notNull(),
    suggestedTasks: jsonb('suggested_tasks').notNull(),
    suggestedTags: text('suggested_tags').array().notNull(),
    summaryOfChanges: text('summary_of_changes').notNull(),
    status: text().notNull(),
    appliedTaskIds: uuid('applied_task_ids').array().notNull().default([]),
    reviewedAt: time('reviewed_at'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
  },
  (t) => [
    uniqueIndex('note_refinements_pending_idx')
      .on(t.noteId)
      .where(sql`${t.status} = 'pending'`),
    uniqueIndex('note_refinements_job_idx').on(t.jobId),
    index('note_refinements_note_idx').on(t.noteId),
    index('note_refinements_creator_idx').on(t.createdBy),
    index('note_refinements_reviewer_idx').on(t.reviewedBy),
    check(
      'note_refinements_status_check',
      sql`${t.status} in ('pending', 'applied', 'discarded', 'stale')`,
    ),
  ],
);
