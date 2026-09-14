import 'server-only';
import { z } from 'zod';
import { defineHandler, authenticated } from './handler';
import { AiModels, AiModelSelection } from '@/core/config/ai-model-schema';
import { modelSettings, selectModels } from '@/core/ai/models';
const response = z.object({ data: AiModels });
export const read = defineHandler({
  guard: 'admin',
  input: z.strictObject({}),
  response,
  handler: async (_, ctx) => ({ data: await modelSettings(ctx.db) }),
});
export const save = defineHandler({
  guard: 'admin',
  input: AiModelSelection,
  response,
  handler: async (input, ctx) => ({
    data: await selectModels(ctx.db, authenticated(ctx).user.id, input),
  }),
});
