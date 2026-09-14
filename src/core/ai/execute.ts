import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { db } from '@/core/db/client';
import { id } from '@/core/db/ids';
import { type Claimed } from '@/core/db/jobs-repo';
import { recordInvocation } from '@/core/db/ai-jobs-repo';
import { AppError } from '@/core/http/errors';
import { AiPayload } from './job-schema';
import { usageFields, failedUsage } from './usage';
import { retryDelay } from '@/core/time/ai';
import { aiExecutionLimits } from '@/core/config/ai';
import { completeStructured } from './provider';
function safeFailure(cause: unknown) {
  if (cause instanceof AppError) return cause;
  if (cause instanceof Anthropic.APIConnectionTimeoutError)
    return new AppError('ai_failed', { reason: 'timeout' });
  if (cause instanceof Anthropic.APIError && [402, 404].includes(cause.status))
    return providerStatusFailure(cause.status);
  if (cause instanceof Anthropic.AuthenticationError)
    return new AppError('ai_failed', { reason: 'invalid_key' });
  if (cause instanceof Anthropic.RateLimitError)
    return new AppError('ai_failed', {
      reason: 'rate_limit',
      retryAfterMs: retryDelay(cause.headers?.get('retry-after')),
    });
  if (
    cause instanceof Anthropic.APIConnectionError ||
    (cause instanceof Anthropic.APIError && cause.status >= 500)
  )
    return new AppError('ai_failed', { reason: 'network' });
  return new AppError('ai_failed', {
    reason: 'provider',
    ...(cause instanceof Anthropic.APIError ? { status: cause.status } : {}),
  });
}
export async function executeAi<S extends z.ZodType>(
  job: Claimed,
  system: string,
  schema: S,
  signal: AbortSignal,
) {
  const payload = AiPayload.parse(job.payload);
  const started = Date.now();
  const base = {
    id: id(),
    jobId: job.id,
    capability: payload.capability,
    capabilityVersion: 1,
    requestedModel: payload.model.id,
    createdBy: job.createdBy,
    pricingVersion: `openrouter-catalog-v1:${job.createdAt.toISOString()}`,
  };
  try {
    const result = await completeStructured(
      payload.model.id,
      payload.maxOutputTokens,
      system,
      payload.input,
      schema,
      signal,
      payload.capability === 'notes.suggest_tags' ? aiExecutionLimits.tags.timeoutMs : aiExecutionLimits.defaultTimeoutMs,
    );
    await recordInvocation(db(), { ...base, effectiveModel: result.model, status: 'ok',
      ...usageFields(result.usage, payload), latencyMs: Date.now() - started,
    });
    return result.output;
  } catch (cause) {
    const error = safeFailure(cause);
    await recordInvocation(db(), {
      ...base,
      status: 'error',
      ...failedUsage(error.details, payload),
      error: JSON.stringify(error.details),
      latencyMs: Date.now() - started,
    });
    throw error;
  }
}

function providerStatusFailure(status: number) {
  return new AppError('ai_failed', status === 402 ? { reason: 'billing' } : { reason: 'model_unavailable', status });
}
