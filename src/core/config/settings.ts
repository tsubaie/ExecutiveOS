import { z } from 'zod';
import { Locale, defaults } from './defaults';
const Theme = z.enum(['dark', 'light']);
const workspace = { readRoles: ['admin'], writeRoles: ['admin'], scope: 'workspace' };
const user = { readRoles: ['admin', 'member'], writeRoles: ['admin', 'member'], scope: 'user' };
function entry(
  key: string,
  schema: z.ZodType,
  value: z.infer<ReturnType<typeof z.json>>,
  scope = workspace,
) {
  if (/secret|password|token$|api.?key/i.test(key)) throw new Error('Secret-like setting key');
  return { key, schema, default: value, ...scope };
}
export const settingsRegistry = [
  entry('workspace.name', z.string().trim().min(1).max(200), defaults.workspaceName),
  entry('workspace.principal_person_id', z.uuid().nullable(), null),
  entry('workspace.default_locale', Locale, defaults.locale),
  entry(
    'workspace.timezone',
    z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat(defaults.locale, { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
    defaults.timezone,
  ),
  entry('workspace.arabic_numerals', z.boolean(), false),
  entry('retention.trash_days', z.number().int().min(1).max(3650), 30),
  entry('retention.meeting_files_days', z.number().int().min(1).max(3650), 365),
  entry('retention.backup_count', z.number().int().min(1).max(100), 14),
  entry('ai.model.default', z.enum(['claude-opus-5', 'claude-sonnet-5']), 'claude-opus-5'),
  entry('ai.model.fast', z.enum(['claude-opus-5', 'claude-sonnet-5']), 'claude-sonnet-5'),
  entry('ai.enabled_capabilities', z.array(z.string()).max(0), []),
  entry('ai.monthly_token_budget', z.number().int().positive().nullable(), null),
  entry('ai.fallbacks', z.boolean(), true),
  entry(
    'notes.types',
    z.array(
      z.object({ id: z.string(), labels: z.record(Locale, z.string()), enabled: z.boolean() }),
    ),
    [],
  ),
  entry('notes.default_type', z.string().nullable(), null),
  entry(
    'kpis.status_thresholds',
    z.object({ onTrack: z.number().min(0).max(100), atRisk: z.number().min(0).max(100) }),
    { onTrack: 90, atRisk: 70 },
  ),
  entry('tasks.default_view', z.string(), 'today'),
  entry('user.locale', Locale, defaults.locale, user),
  entry('user.timezone', z.string(), defaults.timezone, user),
  entry('user.theme', Theme, 'dark', user),
  entry('user.numerals', z.enum(['western', 'arabic']), 'western', user),
];
