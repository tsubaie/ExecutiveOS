import 'server-only';
import { db } from '@/core/db/client';
import { lockWorkspace, initialized, setSetupToken } from '@/core/db/auth-repo';
import { digest, token } from './password';
import { logger } from '@/core/config/logger';
export async function bootstrap() {
  await db().transaction(async (database) => {
    await lockWorkspace(database);
    if (await initialized(database)) return;
    const setupToken = token();
    await setSetupToken(database, digest(setupToken));
    // The bootstrap credential is deliberately printed once at boot, as ADMIN-B01 requires.
    logger.info(`SETUP_TOKEN=${setupToken}`);
  });
}
