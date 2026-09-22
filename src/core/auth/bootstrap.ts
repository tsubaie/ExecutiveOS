import 'server-only';
import { db } from '@/core/db/client';
import { lockWorkspace, initialized, setSetupToken } from '@/core/db/auth-repo';
import { digest, token } from './password';
import { logger } from '@/core/config/logger';
export async function bootstrap() {
  await db().transaction(async (database) => {
    const current = await lockWorkspace(database);
    if (await initialized(database)) {
      // A restart ends the setup replay window (ADMIN-B01).
      if (current.setupTokenHash) await setSetupToken(database, null);
      return;
    }
    const setupToken = token();
    await setSetupToken(database, digest(setupToken));
    // The bootstrap credential is deliberately printed once at boot, as ADMIN-B01 requires.
    logger.info(`SETUP_TOKEN=${setupToken}`);
  });
}
