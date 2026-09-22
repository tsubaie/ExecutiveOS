/**
 * ADMIN-B01: atomic token-protected setup with a bounded replay. ADMIN-B03: user creation is
 * audited. ADMIN-B04: serialize last-admin changes.
 */
import 'server-only';
import { transactional } from '@/core/db/transaction';
import type { z } from 'zod';
import type { Setup } from '@/core/auth/validation';
import { User } from '@/core/auth/validation';
import { digest, hashPassword, matchesToken, token, verifyPassword } from '@/core/auth/password';
import { newSession, type Context } from '@/core/auth/session';
import { db, type Database } from '@/core/db/client';
import {
  lockWorkspace,
  initialized,
  insertUser,
  finishSetup,
  userByEmail,
} from '@/core/db/auth-repo';
import { writeSetting } from '@/core/db/settings-repo';
import { writeAudit } from '@/core/db/audit-repo';
import { id } from '@/core/db/ids';
import { AppError } from '@/core/http/errors';
import { createPerson } from '@/modules/people';
import { selectUsers, updateUser, countAdmins } from './repo';
import type { UserPatch } from './schema/validation';
import { UserCreate } from './schema/validation';

// ADMIN-B01: a setup whose response was lost can be retried. Within this window after completion,
// the identical submission (same token, same fields, the new administrator's password) signs in as
// that administrator instead of failing, so a dropped connection never strands the operator.
const setupReplayMs = 15 * 60 * 1000;
type SetupResult = { user: User; token: string };
// Everything a retry must repeat exactly, except the password, which argon2 checks instead so no
// fast hash of it is ever stored. The 256-bit setup token makes the fingerprint unguessable.
function setupFingerprint(input: z.infer<typeof Setup>) {
  const { setupToken, email, name, workspaceName, locale, timezone, principalName } = input;
  return JSON.stringify([setupToken, email, name, workspaceName, locale, timezone, principalName]);
}
async function replaySetup(
  database: Database,
  workspace: Awaited<ReturnType<typeof lockWorkspace>>,
  input: z.infer<typeof Setup>,
): Promise<SetupResult> {
  const refused = new AppError('conflict', { reason: 'state' });
  const completed = workspace.setupCompletedAt?.getTime() ?? 0;
  if (!workspace.setupTokenHash || Date.now() - completed > setupReplayMs) throw refused;
  if (!matchesToken(setupFingerprint(input), workspace.setupTokenHash)) throw refused;
  const admin = await userByEmail(database, input.email);
  if (
    !admin ||
    admin.role !== 'admin' ||
    !(await verifyPassword(admin.passwordHash, input.password))
  )
    throw refused;
  return { user: User.parse(admin), token: await newSession(database, admin.id) };
}
async function firstSetup(
  database: Database,
  input: z.infer<typeof Setup>,
  passwordHash: string,
): Promise<SetupResult> {
  const user = User.parse(
    await insertUser(database, {
      id: id(),
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'admin',
    }),
  );
  const ctx = { user, db: database, requestId: id() };
  const principal = await createPerson(ctx, {
    fullName: input.principalName || input.name,
    displayName: null,
    honorific: null,
    organization: null,
    roleTitle: null,
    kind: 'internal',
    email: null,
    phone: null,
    notes: null,
    tags: [],
    isAssignable: true,
    userId: input.principalName ? null : user.id,
    confirmDuplicate: true,
  });
  if (!principal.data) throw new Error('Principal creation failed');
  await writeSetting(database, 'workspace.name', input.workspaceName, user.id);
  await writeSetting(database, 'workspace.default_locale', input.locale, user.id);
  await writeSetting(database, 'workspace.timezone', input.timezone, user.id);
  await writeSetting(database, 'workspace.principal_person_id', principal.data.id, user.id);
  await finishSetup(database, digest(setupFingerprint(input)));
  return { user, token: await newSession(database, user.id) };
}
/**
 * ADMIN-B01 one transaction: the request handler's when called from the route (as a savepoint), a
 * new one when called directly. Concurrent submissions serialize on the workspace row.
 */
export async function setup(input: z.infer<typeof Setup>, database: Database = db()) {
  const passwordHash = await hashPassword(input.password);
  return database.transaction(async (tx) => {
    const workspace = await lockWorkspace(tx);
    if (await initialized(tx)) return replaySetup(tx, workspace, input);
    if (!workspace.setupTokenHash || !matchesToken(input.setupToken, workspace.setupTokenHash))
      throw new AppError('forbidden');
    return firstSetup(tx, input, passwordHash);
  });
}
// ADMIN-B03: creating a user generates, hashes and returns the temporary password once, and is
// audited like every other administrative change. Only the user's identity reaches the audit log.
export const createUser = transactional(async function createUser(ctx: Context, input: UserCreate) {
  if (ctx.user.role !== 'admin') throw new AppError('forbidden');
  const temporaryPassword = token();
  const user = User.parse(
    await insertUser(ctx.db, {
      id: id(),
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(temporaryPassword),
    }),
  );
  await writeAudit(ctx.db, ctx.user.id, 'create', 'user', user.id, {
    name: user.name,
    email: user.email,
    role: user.role,
  });
  return { user, temporaryPassword };
});
export async function listUsers(ctx: Context) {
  if (ctx.user.role !== 'admin') throw new AppError('forbidden');
  return (await selectUsers(ctx.db)).map((row) => User.parse(row));
}
export const patchUser = transactional(async function patchUser(
  ctx: Context,
  userId: string,
  input: UserPatch,
) {
  if (ctx.user.role !== 'admin') throw new AppError('forbidden');
  await lockWorkspace(ctx.db);
  const existing = (await selectUsers(ctx.db)).find((user) => user.id === userId);
  if (!existing) throw new AppError('not_found');
  if (
    existing.role === 'admin' &&
    existing.isActive &&
    (input.role === 'member' || input.isActive === false) &&
    (await countAdmins(ctx.db)) <= 1
  )
    throw new AppError('rule_violation', { rule: 'ADMIN-B04' });
  const row = await updateUser(ctx.db, userId, input, ctx.user.id);
  if (!row) throw new AppError('conflict', { reason: 'revision', current: User.parse(existing) });
  await writeAudit(ctx.db, ctx.user.id, 'update', 'user', userId, input);
  return User.parse(row);
});
