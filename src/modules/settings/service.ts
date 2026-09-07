/** ADMIN-B07: registry validation and workspace role allowlists. */
import 'server-only';
import { z } from 'zod';
import { settingsRegistry, isSettingKey, type SettingKey } from '@/core/config/settings';
import { readSettings, writeSetting } from '@/core/db/settings-repo';
import { lockWorkspace } from '@/core/db/auth-repo';
import { writeAudit } from '@/core/db/audit-repo';
import type { Context } from '@/core/auth/session';
import { AppError } from '@/core/http/errors';
export async function listSettings(ctx: Context) {
  if (ctx.user.role !== 'admin') throw new AppError('forbidden');
  const saved = await readSettings(ctx.db);
  return Object.entries(settingsRegistry)
    .filter(([, item]) => item.scope === 'workspace')
    .map(([key, item]) => ({
      key,
      value: z
        .json()
        .parse(
          item.schema.parse(
            saved.find((row) => row.key === key && row.userId === null)?.value ?? item.default,
          ),
        ),
      default: z.json().parse(item.default),
      type: item.schema.def.type,
    }));
}
export async function updateSetting(
  ctx: Context,
  key: string,
  value: z.infer<ReturnType<typeof z.json>>,
) {
  if (!isSettingKey(key)) throw new AppError('validation_failed');
  const item = settingsRegistry[key];
  if (item.scope !== 'workspace' || !item.writeRoles.includes(ctx.user.role))
    throw new AppError('forbidden');
  await lockWorkspace(ctx.db);
  const parsed = z.json().parse(item.schema.parse(value));
  await writeWorkspaceSetting(ctx, key, parsed);
  await writeAudit(ctx.db, ctx.user.id, 'update', 'setting', null, { key, value: parsed });
  return { key, value: parsed, default: z.json().parse(item.default), type: item.schema.def.type };
}
// The registry already validated `value`; this narrows the generic write for a runtime key.
function writeWorkspaceSetting(
  ctx: Context,
  key: SettingKey,
  value: z.infer<ReturnType<typeof z.json>>,
) {
  return writeSetting(ctx.db, key, z.custom<never>().parse(value), ctx.user.id);
}
