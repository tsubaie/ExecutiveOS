import 'server-only';
import { z } from 'zod';
import { defineHandler, authenticated } from './handler';
import { AiCredentialStatus, AiCredentialWrite } from '@/core/config/ai-schema';
import { credentialStatus, saveCredentials, removeCredentials } from '@/core/ai/credentials';
import { resetConnection } from '@/core/ai/client';
const response = z.object({ data: AiCredentialStatus });
export const read = defineHandler({
  guard: 'admin',
  input: z.strictObject({}),
  response,
  handler: async (_, ctx) => ({ data: await credentialStatus(ctx.db) }),
});
export const save = defineHandler({
  guard: 'admin',
  input: AiCredentialWrite,
  response,
  handler: async (input, ctx) => {
    const data = await saveCredentials(ctx.db, authenticated(ctx).user.id, input);
    resetConnection();
    return { data };
  },
});
export const remove = defineHandler({
  guard: 'admin',
  input: z.strictObject({}),
  response,
  handler: async (_, ctx) => {
    const data = await removeCredentials(ctx.db, authenticated(ctx).user.id);
    resetConnection();
    return { data };
  },
});
