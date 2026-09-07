import 'server-only';
import { z } from 'zod';
import { defineHandler, authenticated } from './handler';
import { checkConnection, aiConnection } from '@/core/ai/client';
import { listBackups } from '@/core/backup/dump';
import { Manifest } from '@/core/backup/manifest';
import { enqueue, listJobs } from '@/core/db/jobs-repo';
import { auditEntries, cancelJob, readJob } from '@/core/db/admin-repo';
import { Job, JobKind } from '@/core/jobs/types';
import { AppError } from './errors';
const Empty = z.strictObject({});
const Connection = z.object({
  state: z.string(),
  checkedAt: z.string().nullable(),
  error: z.string().nullable(),
});
export const aiStatus = defineHandler({
  guard: 'admin',
  input: Empty,
  response: z.object({ data: Connection }),
  handler: async () => ({ data: aiConnection() }),
});
export const aiTest = defineHandler({
  guard: 'admin',
  input: Empty,
  response: z.object({ data: Connection }),
  handler: async () => ({ data: await checkConnection() }),
});
export const backups = defineHandler({
  guard: 'admin',
  input: Empty,
  response: z.object({ data: z.array(Manifest) }),
  handler: async () => ({ data: await listBackups() }),
});
export const backupCreate = defineHandler({
  guard: 'admin',
  input: Empty,
  response: z.object({ data: z.object({ id: z.uuid() }) }),
  status: 202,
  idempotent: true,
  handler: async (_, ctx) => ({
    data: await enqueue(
      ctx.db,
      'system.backup',
      {},
      'system.backup:manual',
      authenticated(ctx).user.id,
    ),
  }),
});
export const jobList = defineHandler({
  guard: 'admin',
  input: Empty,
  response: z.object({ data: z.array(Job) }),
  handler: async (_, ctx) => ({
    data: z.array(Job).parse(JSON.parse(JSON.stringify(await listJobs(ctx.db)))),
  }),
});
export const auditList = defineHandler({
  guard: 'admin',
  input: Empty,
  response: z.object({
    data: z.array(
      z.object({
        id: z.uuid(),
        action: z.string(),
        entityType: z.string(),
        entityId: z.string().nullable(),
        createdAt: z.string(),
        diff: z.json(),
      }),
    ),
  }),
  handler: async (_, ctx) => ({ data: JSON.parse(JSON.stringify(await auditEntries(ctx.db))) }),
});
export const jobAction = defineHandler({
  guard: 'admin',
  input: z.strictObject({ action: z.enum(['retry', 'cancel']) }),
  response: z.object({ data: z.object({ id: z.uuid() }) }),
  idempotent: true,
  handler: async (input, ctx, params) => {
    const job = await readJob(ctx.db, z.uuid().parse(params.id));
    if (!job) throw new AppError('not_found');
    if (input.action === 'cancel') {
      await cancelJob(ctx.db, job.id);
      return { data: { id: job.id } };
    }
    if (!['failed', 'cancelled'].includes(job.status))
      throw new AppError('conflict', { reason: 'state' });
    return {
      data: await enqueue(
        ctx.db,
        JobKind.parse(job.kind),
        z.json().parse(job.payload),
        null,
        authenticated(ctx).user.id,
      ),
    };
  },
});
