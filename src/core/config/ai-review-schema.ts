import { z } from 'zod';
import { AiCapability } from './ai-capabilities';
export const AiJobQuery = z.strictObject({ entityId: z.uuid(), capability: AiCapability });
export const AiJobView = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  status: z.string(),
  cancelRequested: z.boolean().optional(),
  revision: z.number(),
  originalContent: z.string().optional(),
  error: z.string().nullable(),
  result: z
    .object({
      output: z.json(),
      warnings: z.array(z.string()),
      appliedIds: z.array(z.uuid()).optional(),
      discarded: z.boolean().optional(),
    })
    .nullable(),
});
