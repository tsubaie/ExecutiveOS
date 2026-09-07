import 'server-only';
import { z } from 'zod';
import { defaults } from './defaults';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());
const Environment = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: optionalText,
  SESSION_SECRET: z.string().min(32),
  APP_URL: z.string().url().default(defaults.appUrl),
  TRUSTED_PROXY_CIDRS: z.string().default(''),
  ANTHROPIC_API_KEY: optionalText,
  FILES_DIR: z.string().default(defaults.filesDir),
  BACKUP_DIR: z.string().default(defaults.backupDir),
  FILES_QUOTA_GB: z.coerce.number().positive().default(20),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(20),
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  JOBS_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
  JOBS_DRAIN_SECONDS: z.coerce.number().int().min(1).max(120).default(25),
  RECOVERY_TOKEN: optionalText,
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_RUNTIME: optionalText,
  NEXT_PHASE: optionalText,
});

export function env() {
  const parsed = Environment.parse(process.env);
  if (parsed.NODE_ENV === 'test')
    return { ...parsed, DATABASE_URL: z.string().url().parse(parsed.DATABASE_URL_TEST) };
  return parsed;
}

export function rawRuntime() {
  return {
    mode: process.env.NODE_ENV,
    runtime: process.env.NEXT_RUNTIME,
    phase: process.env.NEXT_PHASE,
  };
}
