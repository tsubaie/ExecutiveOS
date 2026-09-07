import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { db, pool } from '../../src/core/db/client';
import { initialized, lockWorkspace, setSetupToken } from '../../src/core/db/auth-repo';
import { digest, token } from '../../src/core/auth/password';
// Prepares the browser-test administrator. On an uninitialized workspace it installs a fresh setup
// token and writes credentials for the Playwright global setup to complete first-run setup through
// the real API. On an initialized workspace it only requires the credentials file to exist.
const file = 'e2e/.auth/credentials.json';
const existing = await readFile(file, 'utf8').catch(() => null);
const setupToken = await db().transaction(async (database) => {
  await lockWorkspace(database);
  if (await initialized(database)) return null;
  const fresh = token();
  await setSetupToken(database, digest(fresh));
  return fresh;
});
await pool().end();
if (setupToken) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    file,
    JSON.stringify(
      { email: 'e2e@example.test', password: token(), name: 'E2E Administrator', setupToken },
      null,
      2,
    ),
  );
  process.stdout.write('provisioned\n');
} else if (existing) {
  process.stdout.write('existing\n');
} else {
  process.stderr.write(
    `The workspace is already initialized and ${file} is missing. Create it with {"email","password","name"} for an existing administrator, or point DATABASE_URL at an empty database.\n`,
  );
  process.exit(1);
}
