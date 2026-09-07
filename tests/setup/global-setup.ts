import { env } from '@/core/config/env';
import { ensureTestDatabase } from '@/core/db/test-database';
// Vitest runs this once before any suite. Integration suites share one *_test database.
export default async function setup() {
  let url: string;
  try {
    url = env().DATABASE_URL;
  } catch {
    process.stdout.write(
      'DATABASE_URL_TEST is not configured; integration suites will fail. See README § Development.\n',
    );
    return;
  }
  try {
    await ensureTestDatabase(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (/_test/u.test(reason)) throw error;
    process.stdout.write(
      `Test database unavailable (${reason}); integration suites will fail. Start one with: docker compose -f docker-compose.test.yml up -d\n`,
    );
  }
}
