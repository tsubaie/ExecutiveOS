/** ADMIN-B07: registry validation and workspace role allowlists. */
import 'server-only';
import { z } from 'zod';
import { settingsRegistry } from '@/core/config/settings';
import { readSettings, writeSetting } from '@/core/db/settings-repo';
import { lockWorkspace } from '@/core/db/auth-repo';
import { writeAudit } from '@/core/db/http-repo';
import type { Context } from '@/core/auth/session';
import { AppError } from '@/core/http/errors';
export async function listSettings(ctx: Context) {
  if (ctx.user.role !== 'admin') throw new AppError('forbidden');
  const saved = await readSettings(ctx.db);
  return settingsRegistry
    .filter((item) => item.scope === 'workspace')
    .map((item) => ({
      key: item.key,
      value: z
        .json()
        .parse(
          item.schema.parse(
            saved.find((row) => row.key === item.key && row.userId === null)?.value ?? item.default,
          ),
        ),
      default: item.default,
      type: item.schema.def.type,
    }));
}
export async function updateSetting(
  ctx: Context,
  key: string,
  value: z.infer<ReturnType<typeof z.json>>,
) {
  const item = settingsRegistry.find((item) => item.key === key);
  if (!item) throw new AppError('validation_failed');
  if (item.scope !== 'workspace' || !item.writeRoles.includes(ctx.user.role))
    throw new AppError('forbidden');
  await lockWorkspace(ctx.db);
  const parsed = z.json().parse(item.schema.parse(value));
  await writeSetting(ctx.db, key, parsed, ctx.user.id);
  await writeAudit(ctx.db, ctx.user.id, 'update', 'setting', null, { key, value: parsed });
  return { key, value: parsed, default: item.default, type: item.schema.def.type };
}
