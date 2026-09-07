import { migrateDatabase } from '../../src/core/db/migrate';
import { pool } from '../../src/core/db/client';
await migrateDatabase();
await pool().end();
