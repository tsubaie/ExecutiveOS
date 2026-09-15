import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { Account, AccountPatch, EmailChange, PasswordChange } from './schema/validation';
import * as service from './service';
// ACCT-I01: no handler here takes a user id. The subject is always `ctx.user`, which is what makes
// another reader's account unreachable rather than merely forbidden.
const response = z.object({ data: Account });
export const detail = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response,
  handler: async (_input, ctx) => ({ data: await service.getAccount(authenticated(ctx)) }),
});
export const patch = defineHandler({
  guard: 'session',
  input: AccountPatch,
  response,
  idempotent: true,
  handler: async (input, ctx) => ({ data: await service.patchAccount(authenticated(ctx), input) }),
});
export const email = defineHandler({
  guard: 'session',
  input: EmailChange,
  response,
  idempotent: true,
  handler: async (input, ctx) => ({
    data: await service.changeEmail(authenticated(ctx), input.revision, input.email),
  }),
});
export const password = defineHandler({
  guard: 'session',
  input: PasswordChange,
  response: z.object({ data: z.object({ revoked: z.number().int() }) }),
  idempotent: true,
  handler: async (input, ctx) => ({
    data: await service.changePassword(authenticated(ctx), input.current, input.next),
  }),
});
export const revokeOthers = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: z.object({ data: z.object({ revoked: z.number().int() }) }),
  idempotent: true,
  handler: async (_input, ctx) => ({ data: await service.signOutOthers(authenticated(ctx)) }),
});
export const revokeOne = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: z.object({ data: z.object({ id: z.uuid() }) }),
  idempotent: true,
  handler: async (_input, ctx, params) => ({
    data: await service.revokeSessionById(authenticated(ctx), z.uuid().parse(params.id)),
  }),
});
