import 'server-only';
import { type Context } from '@/core/auth/session';
import { lockedAiJob, requestAiCancellation } from '@/core/db/ai-jobs-repo';
import { writeAudit } from '@/core/db/audit-repo';
import { AiCapability } from '@/core/config/ai-capabilities';
import { AppError } from '@/core/http/errors';
export async function cancelAi(ctx: Context, jobId: string) {
  const job = await lockedAiJob(ctx.db, jobId);
  if (!job || (job.createdBy !== ctx.user.id && ctx.user.role !== 'admin') ||
      !job.kind.startsWith('ai.') || !AiCapability.safeParse(job.kind.slice(3)).success)
    throw new AppError('not_found');
  if (['queued', 'running'].includes(job.status) && !job.cancelRequested) {
    await requestAiCancellation(ctx.db, job);
    await writeAudit(ctx.db, ctx.user.id, 'ai.job.cancel', 'jobs', job.id, {});
  }
  return { id: job.id };
}
