import 'server-only';
import { z } from 'zod';
import { defineHandler, authenticated } from './handler';
import { AiControls, AiControlsWrite } from '@/core/config/ai-controls-schema';
import { readAiControls, saveAiControls } from '@/core/ai/controls';
const response = z.object({ data: AiControls });
export const read = defineHandler({ guard: 'admin', input: z.strictObject({}), response,
  handler: async (_, ctx) => ({ data: await readAiControls(authenticated(ctx)) }),
});
export const save = defineHandler({ guard: 'admin', input: AiControlsWrite, response,
  handler: async (input, ctx) => ({ data: await saveAiControls(authenticated(ctx), input) }),
});
