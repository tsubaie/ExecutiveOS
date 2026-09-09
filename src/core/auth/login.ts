import 'server-only';
import { db, type Database } from '@/core/db/client';
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
import { verifyPassword, hashPassword, matchesToken, digest, placeholderHash } from './password';
import { newSession } from './session';
import { User, type Login, type Recovery } from './validation';
import type { z } from 'zod';
import { env } from '@/core/config/env';
const maxFailures = 5;
// ADMIN-B20: five failures against one email, or five from one client address, close that bucket
// for fifteen minutes. The two are counted apart because their union is a limit nobody configured:
// three failures on an account plus two from an unrelated address used to add up to a lockout.
async function throttle(database: Database, email: string | null, ip: string | null) {
  const failures = await loginFailures(database, email, ip);
  if (failures.byEmail >= maxFailures || failures.byAddress >= maxFailures)
    throw new AppError('rate_limited', { scope: 'login', retryAfterSeconds: 900 });
}
export async function login(input: z.infer<typeof Login>, ip: string | null) {
  const result = await db().transaction(async (database) => {
    await lockLogin(database);
    if (!(await initialized(database))) throw new AppError('forbidden');
    await throttle(database, input.email, ip);
    const user = await userByEmail(database, input.email);
    const usable = Boolean(user && user.isActive && !user.deletedAt);
    // ADMIN-B21: one argon2 verification runs whatever the account state. An unknown, deleted or
    // deactivated address verifies a placeholder of identical cost, so response time cannot
    // separate "no such account" from "wrong password".
    const matched = await verifyPassword(
      user && usable ? user.passwordHash : await placeholderHash(),
      input.password,
    );
    const valid = usable && matched;
    await recordLogin(database, input.email, ip, valid);
    if (!user || !valid) return null;
    return { user: User.parse(user), token: await newSession(database, user.id) };
  });
  if (!result) throw new AppError('unauthenticated');
  return result;
}
// ADMIN-B22: recovery is throttled on the client address alone. The secret being guessed is the
// installation-wide RECOVERY_TOKEN, not a password, so an email bucket would protect nothing while
// handing an attacker a way to lock a named administrator out of ordinary login. Attempts are
// recorded without an email for the same reason. Where no trusted proxy is configured the address
// is unknown and no bucket applies; the token's enforced entropy floor is the control that holds.
export async function recover(input: z.infer<typeof Recovery>, ip: string | null) {
  const configured = env().RECOVERY_TOKEN;
  if (!configured) throw new AppError('not_found');
  await db().transaction(async (database) => {
    await lockLogin(database);
    await throttle(database, null, ip);
    await recordLogin(database, null, ip, false);
  });
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
