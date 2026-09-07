import 'server-only';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '@/core/config/env';
import { queryLogger } from './query-log';

let connection: pg.Pool | undefined;
export function pool() {
  connection ??= new pg.Pool({ connectionString: env().DATABASE_URL, max: env().DB_POOL_MAX });
  return connection;
}
// A separate pool for audits that rebuild the disposable *_test database from migrations.
export function testPool() {
  const url = env().DATABASE_URL_TEST;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error('DATABASE_URL_TEST must name a database ending in _test');
  return new pg.Pool({ connectionString: url, max: 4 });
}
export function databaseFor(source: pg.Pool) {
  return drizzle(source, { logger: queryLogger });
}
export function db() {
  return databaseFor(pool());
}
export type Database = Pick<
  ReturnType<typeof db>,
  'select' | 'insert' | 'update' | 'delete' | 'execute' | 'transaction'
>;
