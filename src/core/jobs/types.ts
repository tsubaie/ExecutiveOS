import 'server-only';
import { z } from 'zod';
import type { Claimed } from '@/core/db/jobs-repo';
import type { Database } from '@/core/db/client';
export const JobStatus = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
export const Job = z.object({
  id: z.uuid(),
  kind: z.string(),
  status: JobStatus,
  attempt: z.number(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  result: z.json().nullable(),
});
export type JobHandler = {
  concurrency: number;
  schema: z.ZodType;
  run: (job: Claimed, signal: AbortSignal) => Promise<z.infer<ReturnType<typeof z.json>>>;
  publish: (database: Database) => Promise<void>;
};
