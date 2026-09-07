import { z } from 'zod';

export const Locale = z.enum(['en', 'ar']);
export const locales = Locale.options;
export const defaults = {
  locale: Locale.enum.en,
  timezone: 'UTC',
  workspaceName: 'ExecutiveOS',
  appUrl: 'http://localhost:3000',
  filesDir: '/var/lib/executiveos/files',
  backupDir: '/var/lib/executiveos/backups',
  cookieName: 'eos_session',
  setupLock: 7232,
  migrationLock: 7231,
};
