import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { Setting, SettingWrite } from './schema/validation';
import { listSettings, updateSetting } from './service';
export const list = defineHandler({
  guard: 'admin',
  input: z.strictObject({}),
  response: z.object({ data: z.array(Setting) }),
  handler: async (_, ctx) => ({ data: await listSettings(authenticated(ctx)) }),
});
export const update = defineHandler({
  guard: 'admin',
  input: SettingWrite,
  response: z.object({ data: Setting }),
  idempotent: true,
  handler: async (input, ctx) => ({
    data: await updateSetting(authenticated(ctx), input.key, input.value),
  }),
});
