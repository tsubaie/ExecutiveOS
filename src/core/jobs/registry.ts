import 'server-only';
import { z } from 'zod';
import { createBackup } from '@/core/backup/dump';
import { prune } from '@/core/db/jobs-repo';
import { purgeExpired } from '@/core/notifications/retention';
import { db } from '@/core/db/client';
import { mergeJobs } from '@/core/modules/registry';
import type { JobHandler } from './types';
const system: Record<string, JobHandler> = {
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
  // NOTIF-B10: retention. A system kind rather than a module's, because the notifications module
  // is the consumer of the contributions and core owns the rows (ADR 0022).
  'system.notifications_purge': {
    concurrency: 1,
    schema: z.strictObject({}),
    run: async () => ({ completed: true }),
    publish: async () => {
      await purgeExpired(db());
    },
  },
  'system.backup': {
    concurrency: 1,
    schema: z.strictObject({}),
    run: async (job, signal) => z.json().parse(await createBackup(job.id, signal)),
    publish: async () => {},
  },
};
// System kinds plus every kind a module declares in its server manifest.
export const registry: Record<string, JobHandler> = mergeJobs(system);
export const jobKinds = Object.keys(registry);
export const JobKind = z.string().refine((kind) => kind in registry, 'unknown job kind');
export function handlerFor(kind: string) {
  const handler = registry[kind];
  if (!handler) throw new Error(`Unknown job kind ${kind}`);
  return handler;
}
