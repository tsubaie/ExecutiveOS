import 'server-only';
import type pg from 'pg';
import { env } from '@/core/config/env';
import { databaseFor, pool } from './client';
import { migrateDatabase } from './migrate';
import { sql } from 'drizzle-orm';
export async function resetDatabase(source: pg.Pool = pool()) {
  if (env().NODE_ENV === 'production') throw new Error('Reset is development-only');
  const database = databaseFor(source);
  await database.execute(sql`drop schema public cascade`);
  await database.execute(sql`create schema public`);
  await database.execute(sql`drop schema if exists drizzle cascade`);
  await migrateDatabase(source);
}
