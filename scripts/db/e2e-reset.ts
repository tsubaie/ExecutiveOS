import { resetDatabase } from '../../src/core/db/reset';
import { env } from '../../src/core/config/env';
import { pool } from '../../src/core/db/client';
// Every browser run starts from an empty workspace, so records earlier runs left behind can never
// change what a test sees. Only a database whose name ends in `_test` is ever wiped; any other
// (a developer's own, or CI's throwaway service database) is left exactly as it is.
const name = new URL(env().DATABASE_URL).pathname.slice(1);
if (name.endsWith('_test')) {
  await resetDatabase();
  process.stdout.write(`reset ${name}\n`);
} else process.stdout.write(`kept ${name}\n`);
await pool().end();
