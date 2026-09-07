import { z } from 'zod';

export const Locale = z.enum(['en', 'ar']);
export const defaults = {
  locale: Locale.enum.en,
  timezone: 'UTC',
  workspaceName: 'ExecutiveOS',
  models: { default: 'claude-opus-5', fast: 'claude-sonnet-5' },
  appUrl: 'http://localhost:3000',
  filesDir: '/var/lib/executiveos/files',
  backupDir: '/var/lib/executiveos/backups',
  cookieName: 'eos_session',
  setupLock: 7232,
  migrationLock: 7231,
};
