import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { aiClient } from './sdk';
import { db, type Database } from '@/core/db/client';
import { getSetting, writeSetting } from '@/core/db/settings-repo';
import { AiModel, AiModelSelection, ModelId, supportsModelSlot } from '@/core/config/ai-model-schema';
import { recentModelOutcomes } from '@/core/db/ai-jobs-repo';
import { readAiCredentials } from '@/core/db/ai-credentials-repo';
import { writeAudit } from '@/core/db/audit-repo';
import { AppError } from '@/core/http/errors';
const Catalog = z.object({
  total_count: z.number().int().nonnegative().optional(),
  links: z.object({ next: z.string().nullable() }).optional(),
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      context_length: z.number().nullable(),
      supported_parameters: z.array(z.string()).default([]),
      architecture: z.object({
        input_modalities: z.array(z.string()),
        output_modalities: z.array(z.string()),
      }),
      top_provider: z.object({ max_completion_tokens: z.number().nullable() }),
      pricing: z.object({ prompt: z.string(), completion: z.string() }),
    }),
  ),
});
let catalog: { credential: string; expiresAt: number; models: z.infer<typeof AiModel>[] } | undefined;
export async function loadModels() {
  const client = await aiClient(10_000);
  if (!client) throw new AppError('ai_unavailable');
  const credential = createHash('sha256').update(client.authToken ?? '').digest('hex');
  if (catalog?.credential === credential && catalog.expiresAt > Date.now())
    return eligibleModels(catalog.models);
  try {
    // ADMIN-B25: this header selects an incompatible, paginated Anthropic catalog shape.
    const entries = await catalogEntries(client);
    const models = entries.filter(
        (model) =>
          ModelId.safeParse(model.id).success &&
          model.supported_parameters.includes('structured_outputs') &&
          model.architecture.input_modalities.includes('text') &&
          model.architecture.output_modalities.includes('text') &&
          (model.context_length ?? 0) > 12288 && !model.id.endsWith(':batch'),
      )
      .map((model) =>
        AiModel.parse({
          id: model.id,
          name: model.name,
          contextLength: model.context_length,
          maxOutputTokens: model.top_provider.max_completion_tokens ?? 4096,
          inputPrice: Number(model.pricing.prompt),
          outputPrice: Number(model.pricing.completion),
        }),
      )
      .filter((model) => model.inputPrice >= 0 && model.outputPrice >= 0 && supportsModelSlot(model, 'fast'))
      .sort((a, b) => a.name.localeCompare(b.name));
    catalog = { credential, models, expiresAt: Date.now() + 60000 };
    return eligibleModels(models);
  } catch {
    throw new AppError('ai_unavailable', { reason: 'models' });
  }
}
export async function modelSettings(database: Database = db()) {
  return {
    models: await loadModels(),
    defaultModel: await getSetting(database, 'ai.model.default'),
    fastModel: await getSetting(database, 'ai.model.fast'),
  };
}
export async function selectModels(database: Database = db(), actor: string, input: unknown) {
  const selection = AiModelSelection.parse(input);
  const models = await loadModels();
  if (!models.some((model) => model.id === selection.defaultModel && supportsModelSlot(model, 'default')) ||
      !models.some((model) => model.id === selection.fastModel && supportsModelSlot(model, 'fast')))
    throw new AppError('ai_unavailable', { reason: 'model' });
  await writeSetting(database, 'ai.model.default', selection.defaultModel, actor);
  await writeSetting(database, 'ai.model.fast', selection.fastModel, actor);
  await writeAudit(database, actor, 'ai.models.update', 'settings', null, selection);
  return { models, ...selection };
}

async function catalogEntries(client: NonNullable<Awaited<ReturnType<typeof aiClient>>>) {
  const entries: z.infer<typeof Catalog>['data'] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const raw: unknown = await client.get('/v1/models/user', {
      headers: { 'anthropic-version': null }, query: { limit: 500, offset },
    });
    const page = Catalog.parse(raw);
    entries.push(...page.data);
    if (!page.links?.next && (page.total_count === undefined || entries.length >= page.total_count))
      return entries;
    if (!page.data.length) break;
  }
  throw new AppError('ai_unavailable', { reason: 'models' });
}
async function eligibleModels(models: z.infer<typeof AiModel>[]) {
  const database = db();
  const saved = await readAiCredentials(database);
  const since = new Date(Math.max(Date.now() - 3600000, saved?.updatedAt.getTime() ?? 0));
  const outcomes = await recentModelOutcomes(database, since);
  const blocked = new Set(outcomes.filter((row) => {
    if (row.status !== 'error' || !row.error) return false;
    try {
      const detail = z.object({ status: z.number().optional(), reason: z.string().optional() }).parse(JSON.parse(row.error));
      return detail.status === 404 || detail.reason === 'model_unavailable';
    } catch { return false; }
  }).map((row) => row.model));
  return models.filter((model) => !blocked.has(model.id));
}
