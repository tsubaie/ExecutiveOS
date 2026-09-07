import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { Home } from './schema/validation';
import { homeSummary } from './service';
export const homeApi = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: z.object({ data: Home }),
  handler: async (_, ctx) => ({ data: await homeSummary(authenticated(ctx)) }),
});
