import 'server-only';
import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
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
// docs/03 § Numbers: KPI values and targets are numeric(14,4) so every value a reading can hold is
// exactly representable as a double once it crosses the JSON boundary.
const amount = (name: string) => numeric(name, { precision: 14, scale: 4, mode: 'number' });
export const objectives = pgTable(
  'objectives',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull().default(1),
    name: text().notNull(),
    description: text().notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
  },
  (t) => [
    index('objectives_order_idx').on(t.sortOrder, t.id),
    index('objectives_creator_idx').on(t.createdBy),
    index('objectives_updater_idx').on(t.updatedBy),
    check('objectives_name_check', sql`length(trim(${t.name})) between 1 and 500`),
    check('objectives_order_check', sql`${t.sortOrder} >= 0`),
  ],
);
export const kpis = pgTable(
  'kpis',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull().default(1),
    name: text().notNull(),
    unit: text().notNull().default('count'),
    direction: text().notNull().default('higher'),
    frequency: text().notNull().default('quarterly'),
    category: text().notNull().default(''),
    objectiveId: uuid('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
    ownerId: uuid('owner_id').references(() => people.id, { onDelete: 'set null' }),
    notes: text().notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
    searchText: text('search_text').generatedAlwaysAs(
      sql`eos_normalize(name || ' ' || category || ' ' || notes)`,
    ),
  },
  (t) => [
    index('kpis_objective_idx').on(t.objectiveId),
    index('kpis_owner_idx').on(t.ownerId),
    index('kpis_creator_idx').on(t.createdBy),
    index('kpis_updater_idx').on(t.updatedBy),
    index('kpis_search_idx').using('gin', t.searchText.op('gin_trgm_ops')),
    index('kpis_name_idx').on(sql`lower(${t.name})`, t.id),
    check('kpis_name_check', sql`length(trim(${t.name})) between 1 and 500`),
    check('kpis_direction_check', sql`${t.direction} in ('higher', 'lower')`),
    check('kpis_unit_check', sql`${t.unit} in ('count', 'percent', 'sar', 'usd', 'points')`),
    check('kpis_frequency_check', sql`${t.frequency} in ('monthly', 'quarterly', 'annual')`),
    check('kpis_order_check', sql`${t.sortOrder} >= 0`),
  ],
);
// KPIS-I01: one reading per KPI per date among the non-deleted rows. Readings carry `revision`
// because KPIS-B08 edits their note in place (docs/03 § Table classes).
export const kpiReadings = pgTable(
  'kpi_readings',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull().default(1),
    kpiId: uuid('kpi_id')
      .notNull()
      .references(() => kpis.id, { onDelete: 'cascade' }),
    readingDate: date('reading_date').notNull(),
    value: amount('value').notNull(),
    note: text().notNull().default(''),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
  },
  (t) => [
    uniqueIndex('kpi_readings_date_unique')
      .on(t.kpiId, t.readingDate)
      .where(sql`${t.deletedAt} is null`),
    index('kpi_readings_kpi_idx').on(t.kpiId, t.readingDate),
    index('kpi_readings_creator_idx').on(t.createdBy),
    index('kpi_readings_updater_idx').on(t.updatedBy),
    check('kpi_readings_value_check', sql`abs(${t.value}) < 10000000000`),
  ],
);
// KPIS-I02: one target per (kpi, year, quarter). Zero and negative targets are allowed; the status
// rules in KPIS-B01 handle them.
export const kpiTargets = pgTable(
  'kpi_targets',
  {
    id: uuid().primaryKey(),
    kpiId: uuid('kpi_id')
      .notNull()
      .references(() => kpis.id, { onDelete: 'cascade' }),
    year: integer().notNull(),
    period: integer().notNull(),
    targetValue: amount('target_value').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    deletedAt: time('deleted_at'),
    deletedOpId: uuid('deleted_op_id'),
  },
  (t) => [
    uniqueIndex('kpi_targets_period_unique')
      .on(t.kpiId, t.year, t.period)
      .where(sql`${t.deletedAt} is null`),
    index('kpi_targets_kpi_idx').on(t.kpiId, t.year, t.period),
    index('kpi_targets_creator_idx').on(t.createdBy),
    check('kpi_targets_period_check', sql`${t.period} between 1 and 12`),
    check('kpi_targets_year_check', sql`${t.year} between 1900 and 2999`),
    check('kpi_targets_value_check', sql`abs(${t.targetValue}) < 10000000000`),
  ],
);
