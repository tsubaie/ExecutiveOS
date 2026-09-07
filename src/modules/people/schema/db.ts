import 'server-only';
import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '@/core/db/system-schema';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const people = pgTable(
  'people',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull().default(1),
    fullName: text('full_name').notNull(),
    displayName: text('display_name'),
    honorific: text(),
    organization: text(),
    roleTitle: text('role_title'),
    kind: text().notNull().default('external'),
    email: text(),
    phone: text(),
    notes: text(),
    tags: text().array().notNull().default([]),
    isAssignable: boolean('is_assignable').notNull().default(false),
    userId: uuid('user_id')
      .unique()
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
  },
  (t) => [
    index('people_name_idx').on(sql`lower(${t.fullName})`, t.id),
    index('people_creator_idx').on(t.createdBy),
    index('people_updater_idx').on(t.updatedBy),
    check('people_kind_check', sql`${t.kind} in ('internal', 'external')`),
    check('people_full_name_check', sql`length(trim(${t.fullName})) > 0`),
  ],
);
