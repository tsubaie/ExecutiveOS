/** ADMIN-B01: atomic token-protected setup. ADMIN-B04: serialize last-admin changes. */
import 'server-only';
import type { z } from 'zod';
import type { Setup } from '@/core/auth/validation';
import { User } from '@/core/auth/validation';
import { hashPassword, matchesToken } from '@/core/auth/password';
import { newSession, type Context } from '@/core/auth/session';
import { db } from '@/core/db/client';
import { lockWorkspace, initialized, insertUser, finishSetup } from '@/core/db/auth-repo';
import { writeSetting } from '@/core/db/settings-repo';
import { writeAudit } from '@/core/db/audit-repo';
import { id } from '@/core/db/ids';
import { AppError } from '@/core/http/errors';
import { createPerson } from '@/modules/people';
import { selectUsers, updateUser, countAdmins } from './repo';
import type { UserPatch } from './schema/validation';

export async function setup(input: z.infer<typeof Setup>) {
  const passwordHash = await hashPassword(input.password);
  return db().transaction(async (database) => {
    const workspace = await lockWorkspace(database);
    if (await initialized(database)) throw new AppError('conflict', { reason: 'state' });
    if (!workspace.setupTokenHash || !matchesToken(input.setupToken, workspace.setupTokenHash))
      throw new AppError('forbidden');
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
    await finishSetup(database);
    return { user, token: await newSession(database, user.id) };
  });
}
export async function listUsers(ctx: Context) {
  if (ctx.user.role !== 'admin') throw new AppError('forbidden');
  return (await selectUsers(ctx.db)).map((row) => User.parse(row));
}
export async function patchUser(ctx: Context, userId: string, input: UserPatch) {
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
}
