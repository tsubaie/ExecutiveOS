import 'server-only';
import { z } from 'zod';
import { type AiPayload } from './job-schema';
export const ProviderUsage = z.object({
  input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative(),
  cache_read_input_tokens: z.number().int().nonnegative().nullable().optional(),
  cache_creation_input_tokens: z.number().int().nonnegative().nullable().optional(),
});
export function usageFields(usage: z.infer<typeof ProviderUsage>, payload: AiPayload) {
  const cached = usage.cache_read_input_tokens ?? 0;
  const written = usage.cache_creation_input_tokens ?? 0;
  return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
    cacheReadTokens: cached, cacheWriteTokens: written,
    estimatedCostMicros: Math.ceil(1000000 * (payload.model.inputPrice * (usage.input_tokens + cached + written) + payload.model.outputPrice * usage.output_tokens)),
  };
}
export function failedUsage(details: unknown, payload: AiPayload) {
  const parsed = z.object({ usage: ProviderUsage }).safeParse(details);
  if (parsed.success) return usageFields(parsed.data.usage, payload);
  // A lost response may still be billed. Retain a conservative reservation in monthly accounting.
  return { inputTokens: Math.ceil(payload.reservedTokens / 2), outputTokens: 0, estimatedCostMicros: null };
}
