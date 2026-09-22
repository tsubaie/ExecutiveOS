import { restoreBackup } from '../../src/core/backup/restore';
const directory = process.argv[2];
if (!directory) throw new Error('Supply backup directory and --confirm');
// ADMIN-B33: an interrupted restore stops at the next phase boundary and cleans up after itself.
const controller = new AbortController();
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals)
  process.once(signal, () => controller.abort(new Error(`Restore interrupted by ${signal}`)));
await restoreBackup(directory, {
  confirmed: process.argv.includes('--confirm'),
  signal: controller.signal,
});
