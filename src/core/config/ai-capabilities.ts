import { z } from 'zod';
export const AiCapability = z.enum(['tasks.breakdown', 'notes.refine', 'notes.suggest_tags']);
export const AiAvailability = z.object({ capabilities: z.array(AiCapability) });
