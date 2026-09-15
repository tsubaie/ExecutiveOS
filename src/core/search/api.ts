import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { searchWorkspace } from './service';
import { TOTAL_LIMIT } from './types';
const Hit = z.object({
  module: z.string(),
  id: z.uuid(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  href: z.string(),
  rank: z.union([z.literal(0), z.literal(1)]),
});
// SEARCH-B06: the response carries what is shown and the modules that could not answer. It never
// carries a total, because counting every match across five tables to render ten rows is work
// nobody asked for.
export const searchApi = defineHandler({
  guard: 'session',
  input: z.strictObject({
    q: z.string().max(200),
    limit: z.coerce.number().int().min(1).max(TOTAL_LIMIT).optional(),
  }),
  response: z.object({ data: z.object({ hits: z.array(Hit), unavailable: z.array(z.string()) }) }),
  handler: async (input, ctx) => ({
    data: await searchWorkspace(authenticated(ctx), input.q, input.limit ?? TOTAL_LIMIT),
  }),
});
