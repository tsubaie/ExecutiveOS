import pg from 'pg';
export function assertTestDatabase(url: string) {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.slice(1));
  if (!name.endsWith('_test'))
    throw new Error(`Test database name must end with _test, received "${name}"`);
  return { url: parsed, name };
}
export async function ensureTestDatabase(url: string) {
  const { url: parsed, name } = assertTestDatabase(url);
  const admin = new URL(parsed);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (!rowCount) await client.query(`create database "${name.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }
  return name;
}
