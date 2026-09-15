import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { NotificationFeed, FeedQuery } from './schema/validation';
import * as service from './service';
// NOTIF-I04: the reader is `ctx.user`. No handler here takes a user id, so another reader's feed
// is unreachable rather than merely forbidden.
export const feed = defineHandler({
  guard: 'session',
  input: FeedQuery,
  response: NotificationFeed,
  handler: async (input, ctx) => ({
    data: await service.feed(authenticated(ctx), input.limit ?? 20, input.cursor ?? null),
  }),
});
export const read = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: z.object({ data: z.object({ id: z.uuid(), readAt: z.string().nullable() }) }),
  idempotent: true,
  handler: async (_input, ctx, params) => ({
    data: await service.readOne(authenticated(ctx), z.uuid().parse(params.id)),
  }),
});
export const readAll = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: z.object({ data: z.object({ marked: z.number().int() }) }),
  idempotent: true,
  handler: async (_input, ctx) => ({ data: await service.readAll(authenticated(ctx)) }),
});
