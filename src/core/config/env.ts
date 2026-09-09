import 'server-only';
import { z } from 'zod';
import { defaults } from './defaults';
import { validProxyCidrs } from './cidr';

const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());
const Environment = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: optionalText,
  SESSION_SECRET: z.string().min(32),
  APP_URL: z.string().url().default(defaults.appUrl),
  TRUSTED_PROXY_CIDRS: z
    .string()
    .default('')
    .refine(validProxyCidrs, {
      message:
        'TRUSTED_PROXY_CIDRS must be a comma-separated list of IP addresses or CIDR blocks, for example "10.0.0.0/8, fd00::/8"',
    }),
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
  DB_POOL_MAX: z.coerce.number().int().min(2).max(64).default(12),
  RECOVERY_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .min(
        32,
        'RECOVERY_TOKEN replaces an administrator password and must be at least 32 random characters; generate one with: openssl rand -hex 32',
      )
      .optional(),
  ),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_RUNTIME: optionalText,
  NEXT_PHASE: optionalText,
});

// ADMIN-B17: a deployment typo must not silently downgrade the session cookie. Loopback is the one
// opt-out, so a production image can still be smoke-tested on a developer machine without TLS.
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
function loopback(url: string) {
  return loopbackHosts.has(new URL(url).hostname);
}
const Configuration = Environment.superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') return;
  if (value.APP_URL.startsWith('https:') || loopback(value.APP_URL)) return;
  ctx.addIssue({
    code: 'custom',
    path: ['APP_URL'],
    message: 'APP_URL must use https in production unless it points at a loopback address',
  });
});

export type Environment = z.infer<typeof Environment>;
export function parseEnvironment(source: Record<string, string | undefined>) {
  return Configuration.parse(source);
}
// The Secure flag follows the validated deployment mode: production is HTTPS unless it is the
// loopback opt-out, and a development server marks the cookie only when it actually serves TLS.
export function secureCookies(config: Environment = env()) {
  return config.NODE_ENV === 'production'
    ? !loopback(config.APP_URL)
    : config.APP_URL.startsWith('https:');
}
let cached: Environment | undefined;
function load(): Environment {
  const parsed = parseEnvironment(process.env);
  if (parsed.NODE_ENV === 'test')
    return { ...parsed, DATABASE_URL: z.string().url().parse(parsed.DATABASE_URL_TEST) };
  return parsed;
}
// Parsed once per process; every request path reads it.
export function env() {
  cached ??= load();
  return cached;
}

export function rawRuntime() {
  return {
    mode: process.env.NODE_ENV,
    runtime: process.env.NEXT_RUNTIME,
    phase: process.env.NEXT_PHASE,
  };
}
