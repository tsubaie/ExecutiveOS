import 'server-only';
import { z } from 'zod';
import { createBackup } from '@/core/backup/dump';
import { prune } from '@/core/db/jobs-repo';
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
