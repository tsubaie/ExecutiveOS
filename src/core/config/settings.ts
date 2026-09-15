import { z } from 'zod';
import { AiCapability } from './ai-capabilities';
import { ModelId } from './ai-model-schema';
import { Locale, defaults } from './defaults';
export const Theme = z.enum(['dark', 'light']);
export const Timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat(defaults.locale, { timeZone: value });
    return true;
  } catch {
    return false;
  }
});
// KPIS-I04: the ratio bands a KPI's status is read against. `on` and `near` are ratios of current
// to target, so they run the same way the direction does: for `higher` a bigger ratio is better and
// `on` must not sit below `near`; for `lower` the ratio is inverted and the order flips.
const Band = z.object({ on: z.number().positive().max(100), near: z.number().positive().max(100) });
export const StatusThresholds = z
  .object({ higher: Band, lower: Band })
  .refine((value) => value.higher.on >= value.higher.near && value.lower.on <= value.lower.near, {
    error: 'thresholds_order',
  });
export type StatusThresholds = z.output<typeof StatusThresholds>;
type Scope = Pick<SettingEntry, 'readRoles' | 'writeRoles' | 'scope'>;
const workspace: Scope = { readRoles: ['admin'], writeRoles: ['admin'], scope: 'workspace' };
const user: Scope = {
  readRoles: ['admin', 'member'],
  writeRoles: ['admin', 'member'],
  scope: 'user',
};
export type SettingEntry<S extends z.ZodType = z.ZodType> = {
  schema: S;
  default: z.output<S>;
  readRoles: readonly string[];
  writeRoles: readonly string[];
  scope: 'workspace' | 'user';
};
function entry<S extends z.ZodType>(schema: S, value: z.output<S>, scope: Scope = workspace) {
  return { schema, default: value, ...scope };
}
// Keys are the contract: typed access through getSetting/writeSetting, no string-keyed reads.
export const settingsRegistry = {
  'workspace.name': entry(z.string().trim().min(1).max(200), defaults.workspaceName),
  'workspace.principal_person_id': entry(z.uuid().nullable(), null),
  'workspace.default_locale': entry(Locale, defaults.locale),
  'workspace.timezone': entry(Timezone, defaults.timezone),
  'workspace.arabic_numerals': entry(z.boolean(), false),
  'retention.trash_days': entry(z.number().int().min(1).max(3650), 30),
  'retention.meeting_files_days': entry(z.number().int().min(1).max(3650), 365),
  'retention.backup_count': entry(z.number().int().min(1).max(100), 14),
  'ai.model.default': entry(ModelId, defaults.models.default),
  'ai.model.fast': entry(ModelId, defaults.models.fast),
  'ai.enabled_capabilities': entry(z.array(AiCapability), AiCapability.options),
  'ai.monthly_token_budget': entry(z.number().int().positive().nullable(), null),
  'ai.fallbacks': entry(z.boolean(), true),
  'notes.types': entry(
    z.array(
      z.object({ id: z.string(), labels: z.record(Locale, z.string()), enabled: z.boolean() }),
    ),
    [],
  ),
  'notes.default_type': entry(z.string().nullable(), null),
  'kpis.status_thresholds': entry(StatusThresholds, {
    higher: { on: 0.99, near: 0.85 },
    lower: { on: 1.01, near: 1.18 },
  }),
  'tasks.default_view': entry(z.string(), 'today'),
  'user.locale': entry(Locale, defaults.locale, user),
  'user.timezone': entry(Timezone, defaults.timezone, user),
  'user.theme': entry(Theme, 'dark', user),
  'user.numerals': entry(z.enum(['western', 'arabic']), 'western', user),
} satisfies Record<string, SettingEntry>;
export type SettingKey = keyof typeof settingsRegistry;
export type SettingValue<K extends SettingKey> = z.output<(typeof settingsRegistry)[K]['schema']>;
export const settingKeys = Object.keys(settingsRegistry).filter(isSettingKey);
export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(settingsRegistry, key);
}
const secretLike = /secret|password|token$|api.?key/iu;
for (const key of settingKeys)
  if (secretLike.test(key)) throw new Error(`Secret-like setting key: ${key}`);
