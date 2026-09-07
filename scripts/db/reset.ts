import { resetDatabase } from '../../src/core/db/reset';
import { pool } from '../../src/core/db/client';
await resetDatabase();
await pool().end();
