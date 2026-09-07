import { restoreBackup } from '../../src/core/backup/restore';
const directory = process.argv[2];
if (!directory) throw new Error('Supply backup directory and --confirm');
await restoreBackup(directory, process.argv.includes('--confirm'));
