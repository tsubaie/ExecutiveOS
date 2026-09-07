import 'server-only';
import { z } from 'zod';
import { createBackup } from '@/core/backup/dump';
import { prune, type Claimed } from '@/core/db/jobs-repo';
import type { Database } from '@/core/db/client';
import type { Kind } from './types';
type Handler = {
  concurrency: number;
  schema: z.ZodType;
  run: (job: Claimed, signal: AbortSignal) => Promise<z.infer<ReturnType<typeof z.json>>>;
  publish: (database: Database) => Promise<void>;
};
export const registry: Record<Kind, Handler> = {
  'system.noop': {
    concurrency: 4,
    schema: z.strictObject({}),
    run: async () => ({ completed: true }),
    publish: async () => {},
  },
  'system.prune': {
    concurrency: 1,
    schema: z.strictObject({}),
    run: async () => ({ completed: true }),
    publish: prune,
  },
  'system.backup': {
    concurrency: 1,
    schema: z.strictObject({}),
    run: async (job, signal) => z.json().parse(await createBackup(job.id, signal)),
    publish: async () => {},
  },
};
