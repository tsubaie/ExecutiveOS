import 'server-only';
import { db } from '@/core/db/client';
import {
  initialized,
  lockLogin,
  loginFailures,
  recordLogin,
  userByEmail,
  lockWorkspace,
  usedRecovery,
  recoverUser,
} from '@/core/db/auth-repo';
import { AppError } from '@/core/http/errors';
import { verifyPassword, hashPassword, matchesToken, digest } from './password';
import { newSession } from './session';
import { User, type Login, type Recovery } from './validation';
import type { z } from 'zod';
import { env } from '@/core/config/env';
export async function login(input: z.infer<typeof Login>, ip: string) {
  const result = await db().transaction(async (database) => {
    await lockLogin(database);
    if (!(await initialized(database))) throw new AppError('forbidden');
    if ((await loginFailures(database, input.email, ip)) >= 5)
      throw new AppError('rate_limited', { scope: 'login', retryAfterSeconds: 900 });
    const user = await userByEmail(database, input.email);
    const valid =
      user &&
      user.isActive &&
      !user.deletedAt &&
      (await verifyPassword(user.passwordHash, input.password));
    await recordLogin(database, input.email, ip, Boolean(valid));
    if (!user || !valid) return null;
    return { user: User.parse(user), token: await newSession(database, user.id) };
  });
  if (!result) throw new AppError('unauthenticated');
  return result;
}
export async function recover(input: z.infer<typeof Recovery>) {
  const configured = env().RECOVERY_TOKEN;
  if (!configured) throw new AppError('not_found');
  if (!matchesToken(input.token, digest(configured))) throw new AppError('forbidden');
  const passwordHash = await hashPassword(input.password);
  await db().transaction(async (database) => {
    await lockWorkspace(database);
    if (await usedRecovery(database, digest(configured)))
      throw new AppError('conflict', { reason: 'state' });
    const user = await userByEmail(database, input.email);
    if (!user || user.role !== 'admin' || !user.isActive) throw new AppError('not_found');
    await recoverUser(database, user.id, digest(configured), passwordHash);
  });
}
