import { z } from 'zod';
export const AiProvider = z.literal('openrouter');
export const AiCredentialWrite = z.strictObject({
  apiKey: z.string().trim().min(1).max(4096).regex(/^\S+$/u),
});
export const AiCredentialStatus = z.object({
  provider: AiProvider,
  source: z.enum(['saved', 'environment', 'none']),
});
