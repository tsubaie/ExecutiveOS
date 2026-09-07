import 'server-only';
import { z } from 'zod';
export const JobKind = z.enum(['system.noop', 'system.prune', 'system.backup']);
export const JobStatus = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
export const Job = z.object({
  id: z.uuid(),
  kind: JobKind,
  status: JobStatus,
  attempt: z.number(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  result: z.json().nullable(),
});
export type Kind = z.infer<typeof JobKind>;
