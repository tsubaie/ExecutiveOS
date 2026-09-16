import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { type Context } from '@/core/auth/session';
import { getSetting } from '@/core/db/settings-repo';
import { enqueue } from '@/core/db/jobs-repo';
import {
  lockAiAdmission,
  aiAdmissionUsage,
  prepareAiJob,
  latestAiJob,
} from '@/core/db/ai-jobs-repo';
import { monthStart } from '@/core/time/ai';
import { aiExecutionLimits } from '@/core/config/ai';
import { supportsModelSlot } from '@/core/config/ai-model-schema';
import { AiCapability } from '@/core/config/ai-capabilities';
import { AppError } from '@/core/http/errors';
import { env } from '@/core/config/env';
import { loadModels } from './models';
import { aiConnection, checkConnection } from './client';
import { framedInput } from './framing';
import { AiPayload } from './job-schema';
export function contentHash(input: z.infer<ReturnType<typeof z.json>>) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
export async function availableCapabilities(ctx: Context) {
  if (!env().JOBS_ENABLED) return [];
  // Route bundles may not share instrumentation's module state; initialize on demand.
  const connection = aiConnection();
  if (connection.checkedAt === null || Date.now() - Date.parse(connection.checkedAt) > 60000)
    await checkConnection(ctx.db);
  if (aiConnection().state !== 'enabled') return [];
  const enabled = await getSetting(ctx.db, 'ai.enabled_capabilities');
  const defaultModel = await getSetting(ctx.db, 'ai.model.default');
  const fastModel = await getSetting(ctx.db, 'ai.model.fast');
  try {
    const models = await loadModels();
    return enabled.filter((capability) => {
      const slot = capability === 'notes.suggest_tags' ? 'fast' : 'default';
      return models.some((model) => model.id === (slot === 'fast' ? fastModel : defaultModel) && supportsModelSlot(model, slot));
    });
  } catch {
    return [];
  }
}
// Whether this workspace means to use AI at all: a provider credential exists and at least one
// capability is turned on. It is the difference between a fault a reader should hear about and a
// feature this office simply does not use, which is not news on any record, let alone every one.
// `availableCapabilities` refreshes the connection first, so the state read here is the fresh one.
export async function aiAvailability(ctx: Context) {
  const capabilities = await availableCapabilities(ctx);
  const enabled = await getSetting(ctx.db, 'ai.enabled_capabilities');
  const configured =
    env().JOBS_ENABLED && aiConnection().state !== 'disabled' && enabled.length > 0;
  return { capabilities, configured };
}
export async function admitAi(
  ctx: Context,
  capability: z.infer<typeof AiCapability>,
  entityId: string,
  revision: number,
  input: z.infer<ReturnType<typeof z.json>>,
) {
  if (!(await availableCapabilities(ctx)).includes(capability))
    throw new AppError('ai_unavailable');
  const { model, maxOutputTokens, estimate } = await chooseModel(ctx, capability, input);
  const locale = await getSetting(ctx.db, 'user.locale', ctx.user.id);
  const payload = AiPayload.parse({
    capability,
    entityId,
    revision,
    input,
    model,
    locale,
    capabilityVersion: 1,
    promptVersion: capability === 'notes.refine' ? 2 : 1,
    contentHash: contentHash(input),
    maxOutputTokens,
    reservedTokens: 2 * (estimate + maxOutputTokens),
  });
  await lockAiAdmission(ctx.db);
  const active = await latestAiJob(ctx.db, ctx.user.id, entityId, `ai.${capability}`);
  if (active && ['queued', 'running'].includes(active.status)) return { id: active.id };
  const budget = await getSetting(ctx.db, 'ai.monthly_token_budget');
  const usage = await aiAdmissionUsage(
    ctx.db,
    ctx.user.id,
    `ai.${capability}`,
    monthStart(await getSetting(ctx.db, 'workspace.timezone')),
  );
  if (env().AI_RATE_LIMIT_ENABLED && usage.count >= (capability === 'notes.suggest_tags' ? 60 : 30))
    throw new AppError('ai_unavailable', { reason: 'rate_limit', retryAfterMs: usage.retryAfterMs, limit: capability === 'notes.suggest_tags' ? 60 : 30 });
  if (budget !== null && usage.tokens + payload.reservedTokens > budget)
    throw new AppError('ai_unavailable', { reason: 'budget' });
  const job = await enqueue(
    ctx.db,
    `ai.${capability}`,
    z.json().parse(payload),
    `${capability}:${entityId}`,
    ctx.user.id,
  );
  if (job.createdBy !== ctx.user.id) throw new AppError('conflict', { reason: 'state' });
  await prepareAiJob(ctx.db, job.id, entityId);
  return { id: job.id };
}

async function chooseModel(
  ctx: Context,
  capability: z.infer<typeof AiCapability>,
  input: z.infer<ReturnType<typeof z.json>>,
) {
  const slot = capability === 'notes.suggest_tags' ? 'ai.model.fast' : 'ai.model.default';
  const selected = await getSetting(ctx.db, slot);
  const model = (await loadModels()).find((entry) => entry.id === selected);
  if (!model) throw new AppError('ai_unavailable', { reason: 'model' });
  const maxOutputTokens = Math.min(
    capability === 'notes.refine' ? 16000 : capability === 'notes.suggest_tags' ? aiExecutionLimits.tags.maxOutputTokens : 4096,
    model.maxOutputTokens,
  );
  const estimate = Buffer.byteLength(framedInput(input)) + 8192;
  if (estimate + maxOutputTokens > model.contextLength)
    throw new AppError('ai_unavailable', { reason: 'context' });
  return { model, maxOutputTokens, estimate };
}
