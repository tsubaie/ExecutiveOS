export async function register() {
  const { rawRuntime } = await import('./core/config/env');
  const runtime = rawRuntime();
  if (
    runtime.runtime !== 'nodejs' ||
    runtime.mode === 'test' ||
    runtime.phase === 'phase-production-build'
  )
    return;
  const { migrateDatabase } = await import('./core/db/migrate');
  const { bootstrap } = await import('./core/auth/bootstrap');
  await migrateDatabase();
  await bootstrap();
  const { env } = await import('./core/config/env');
  const { checkConnection } = await import('./core/ai/client');
  await checkConnection();
  if (env().JOBS_ENABLED) {
    const { startRunner } = await import('./core/jobs/runner');
    const stop = startRunner();
    process.once('SIGTERM', stop);
  }
}
