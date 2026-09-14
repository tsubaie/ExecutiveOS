import 'server-only';
import { type Context } from '@/core/auth/session';
import { getSetting, writeSetting } from '@/core/db/settings-repo';
import { writeAudit } from '@/core/db/audit-repo';
import { aiUsage } from '@/core/db/ai-jobs-repo';
import { AiControlsWrite } from '@/core/config/ai-controls-schema';
import { monthStart } from '@/core/time/ai';
export async function readAiControls(ctx: Context) {
  return { enabledCapabilities: await getSetting(ctx.db, 'ai.enabled_capabilities'),
    monthlyTokenBudget: await getSetting(ctx.db, 'ai.monthly_token_budget'),
    ...await aiUsage(ctx.db, monthStart(await getSetting(ctx.db, 'workspace.timezone'))),
  };
}
export async function saveAiControls(ctx: Context, input: unknown) {
  const value = AiControlsWrite.parse(input);
  await writeSetting(ctx.db, 'ai.enabled_capabilities', [...new Set(value.enabledCapabilities)], ctx.user.id);
  await writeSetting(ctx.db, 'ai.monthly_token_budget', value.monthlyTokenBudget, ctx.user.id);
  await writeAudit(ctx.db, ctx.user.id, 'ai.controls.update', 'settings', null, value);
  return readAiControls(ctx);
}
