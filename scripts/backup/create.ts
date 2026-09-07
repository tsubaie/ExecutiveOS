import { createBackup } from '../../src/core/backup/dump';
import { id } from '../../src/core/db/ids';
process.stdout.write(JSON.stringify(await createBackup(id())) + '\n');
