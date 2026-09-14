import 'server-only';
import { z } from 'zod';
import { defineHandler, authenticated } from './handler';
import { cancelAi } from '@/core/ai/cancel';
import { availableCapabilities } from '@/core/ai/admission';
import { AiAvailability } from '@/core/config/ai-capabilities';
import { AiJobQuery, AiJobView } from '@/core/config/ai-review-schema';
import { latestAiJob, lastInvocationError } from '@/core/db/ai-jobs-repo';
import { AiPayload, AiOutput } from '@/core/ai/job-schema';
export const availability = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: z.object({ data: AiAvailability }),
  handler: async (_, ctx) => ({
    data: { capabilities: await availableCapabilities(authenticated(ctx)) },
  }),
});
export const latest = defineHandler({
  guard: 'session',
  input: AiJobQuery,
  response: z.object({ data: AiJobView.nullable() }),
  handler: async (input, ctx) => {
    const job = await latestAiJob(
      ctx.db,
      authenticated(ctx).user.id,
      input.entityId,
      `ai.${input.capability}`,
    );
    return {
      data: job
        ? {
            id: job.id,
            createdAt: job.createdAt.toISOString(),
            status: job.status,
            cancelRequested: job.cancelRequested,
            revision: AiPayload.parse(job.payload).revision,
            ...(input.capability === 'notes.refine' ? {
              originalContent: z.object({ content: z.string() }).parse(AiPayload.parse(job.payload).input).content,
            } : {}),
            error: job.lastError === 'provider'
              ? failureReason(await lastInvocationError(ctx.db, job.id))
              : job.lastError,
            result: job.result ? AiOutput.parse(job.result) : null,
          }
        : null,
    };
  },
});

function failureReason(raw: string | null) {
  if (!raw) return 'provider';
  try {
    const detail = z.object({ status: z.number().optional() }).parse(JSON.parse(raw));
    return detail.status === 404 ? 'model_unavailable' : 'provider';
  } catch {
    return 'provider';
  }
}

export const cancel = defineHandler({
  guard: 'session', input: z.strictObject({ jobId: z.uuid() }),
  response: z.object({ data: z.object({ id: z.uuid() }) }),
  handler: async (input, ctx) => ({ data: await cancelAi(authenticated(ctx), input.jobId) }),
});
