import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { setSessionCookie, setLocaleCookie } from '@/core/auth/session';
import { Setup, User } from '@/core/auth/validation';
import { setup, listUsers, patchUser } from './service';
import { UserPatch, UserCreate } from './schema/validation';
import { insertUser } from '@/core/db/auth-repo';
import { hashPassword, token } from '@/core/auth/password';
import { id } from '@/core/db/ids';
export const setupApi = defineHandler({
  guard: 'public',
  input: Setup,
  response: z.object({ data: User }),
  handler: async (input) => {
    const result = await setup(input);
    await setSessionCookie(result.token);
    await setLocaleCookie(input.locale);
    return { data: result.user };
  },
});
export const list = defineHandler({
  guard: 'admin',
  input: z.strictObject({}),
  response: z.object({ data: z.array(User) }),
  handler: async (_, ctx) => ({ data: await listUsers(authenticated(ctx)) }),
});
export const patch = defineHandler({
  guard: 'admin',
  input: UserPatch,
  response: z.object({ data: User }),
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await patchUser(authenticated(ctx), z.uuid().parse(params.id), input),
  }),
});
export const create = defineHandler({
  guard: 'admin',
  input: UserCreate,
  response: z.object({ data: User, meta: z.object({ temporaryPassword: z.string() }) }),
  status: 201,
  idempotent: true,
  handler: async (input, ctx) => {
    const temporaryPassword = token();
    const row = await insertUser(ctx.db, {
      id: id(),
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(temporaryPassword),
    });
    return { data: User.parse(row), meta: { temporaryPassword } };
  },
});
