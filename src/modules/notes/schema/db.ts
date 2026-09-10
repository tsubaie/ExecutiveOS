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
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '@/core/db/system-schema';
import { people } from '@/modules/people/schema/db';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const notes = pgTable(
  'notes',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull().default(1),
    title: text().notNull(),
    content: text().notNull().default(''),
    type: text().notNull(),
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
