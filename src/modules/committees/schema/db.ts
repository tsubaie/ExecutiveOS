import 'server-only';
import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '@/core/db/system-schema';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const committees = pgTable('committees', {
  id: uuid().primaryKey(), revision: integer().notNull().default(1),
  name: text().notNull(), description: text().notNull().default(''),
  ownership: text().notNull().default(''), scope: text().notNull().default('internal'),
  status: text().notNull().default('active'), sortOrder: integer('sort_order').notNull().default(0),
  createdAt: time('created_at').notNull().defaultNow(), updatedAt: time('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id), updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: time('deleted_at'), deletedOpId: uuid('deleted_op_id'),
  searchText: text('search_text').generatedAlwaysAs(sql`eos_normalize(name || ' ' || description || ' ' || ownership)`),
}, (t) => [
  uniqueIndex('committees_name_unique').on(sql`lower(${t.name})`).where(sql`${t.deletedAt} is null`),
  index('committees_creator_idx').on(t.createdBy), index('committees_updater_idx').on(t.updatedBy),
  index('committees_search_idx').using('gin', t.searchText.op('gin_trgm_ops')),
  index('committees_status_idx').on(t.status, t.deletedAt),
  check('committees_name_check', sql`length(trim(${t.name})) between 1 and 500`),
  check('committees_scope_check', sql`${t.scope} in ('internal','external')`),
  check('committees_status_check', sql`${t.status} in ('active','archived')`),
  check('committees_order_check', sql`${t.sortOrder} >= 0`),
]);
