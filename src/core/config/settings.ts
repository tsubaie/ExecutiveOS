import { z } from 'zod';
import { Locale, defaults } from './defaults';
const Theme = z.enum(['dark', 'light']);
const ModelId = z.string().regex(/^claude-[a-z0-9-]+$/u);
const Timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat(defaults.locale, { timeZone: value });
    return true;
  } catch {
    return false;
  }
});
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
  'ai.enabled_capabilities': entry(z.array(z.string()).max(0), []),
  'ai.monthly_token_budget': entry(z.number().int().positive().nullable(), null),
  'ai.fallbacks': entry(z.boolean(), true),
  'notes.types': entry(
    z.array(
      z.object({ id: z.string(), labels: z.record(Locale, z.string()), enabled: z.boolean() }),
    ),
    [],
  ),
  'notes.default_type': entry(z.string().nullable(), null),
  'kpis.status_thresholds': entry(
    z.object({ onTrack: z.number().min(0).max(100), atRisk: z.number().min(0).max(100) }),
    { onTrack: 90, atRisk: 70 },
  ),
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
