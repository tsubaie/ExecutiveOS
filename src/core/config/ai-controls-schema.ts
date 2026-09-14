import { z } from 'zod';
import { AiCapability } from './ai-capabilities';
export const AiControlsWrite = z.strictObject({
  enabledCapabilities: z.array(AiCapability).max(3),
  monthlyTokenBudget: z.number().int().positive().nullable(),
});
export const AiUsageRow = z.object({ capability: z.string(), calls: z.number(), inputTokens: z.number(), outputTokens: z.number(), cacheTokens: z.number(), estimatedCostMicros: z.number() });
export const AiControls = AiControlsWrite.extend({
  usedTokens: z.number(), reservedTokens: z.number(), usage: z.array(AiUsageRow),
});
