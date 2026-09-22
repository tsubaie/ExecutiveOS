import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { setSessionCookie, setLocaleCookie } from '@/core/auth/session';
import { Setup, User } from '@/core/auth/validation';
import { setup, listUsers, patchUser, createUser } from './service';
import { UserPatch, UserCreate } from './schema/validation';
export const setupApi = defineHandler({
  guard: 'public',
  input: Setup,
  response: z.object({ data: User }),
  handler: async (input, ctx) => {
    const result = await setup(input, ctx.db);
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
    const created = await createUser(authenticated(ctx), input);
    return { data: created.user, meta: { temporaryPassword: created.temporaryPassword } };
  },
});
