import 'server-only';
import { z } from 'zod';
import { AiCapability } from '@/core/config/ai-capabilities';
import { AiModel } from '@/core/config/ai-model-schema';
import { Locale } from '@/core/config/defaults';
export const AiPayload = z.object({
  capability: AiCapability,
  capabilityVersion: z.literal(1),
  promptVersion: z.union([z.literal(1), z.literal(2)]),
  entityId: z.uuid(),
  revision: z.number().int().positive(),
  contentHash: z.string(),
  model: AiModel,
  locale: Locale,
  input: z.json(),
  reservedTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
});
export type AiPayload = z.infer<typeof AiPayload>;
export const AiOutput = z.object({
  output: z.json(),
  warnings: z.array(z.string()).default([]),
  discarded: z.boolean().optional(),
  appliedIds: z.array(z.uuid()).optional(),
});

export type AiOutput = z.infer<typeof AiOutput>;
