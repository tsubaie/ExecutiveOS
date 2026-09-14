import 'server-only';
import { type Context } from '@/core/auth/session';
import { lockedAiJob, updateAiResult } from '@/core/db/ai-jobs-repo';
import { AppError } from '@/core/http/errors';
import { AiOutput, AiPayload } from './job-schema';
export async function reviewJob(ctx: Context, jobId: string, entityId: string, capability: string) {
  const job = await lockedAiJob(ctx.db, jobId);
  if (!job || (job.createdBy !== ctx.user.id && ctx.user.role !== 'admin'))
    throw new AppError('not_found');
  const payload = AiPayload.parse(job.payload);
  if (
    job.kind !== `ai.${capability}` ||
    payload.entityId !== entityId ||
    job.status !== 'succeeded'
  )
    throw new AppError('conflict', { reason: 'state' });
  const result = AiOutput.parse(job.result);
  if (result.discarded) throw new AppError('conflict', { reason: 'state' });
  return { job, payload, result };
}
export async function applied(ctx: Context, jobId: string, result: AiOutput, appliedIds: string[]) {
  await updateAiResult(ctx.db, jobId, { ...result, appliedIds });
}
