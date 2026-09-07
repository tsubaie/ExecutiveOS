import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { exists } from '../audit/lib/files';
// Next's standalone output expects static assets and public files next to server.js.
const root = process.cwd();
const standalone = join(root, '.next/standalone');
if (await exists(standalone)) {
  await cp(join(root, '.next/static'), join(standalone, '.next/static'), { recursive: true });
  if (await exists(join(root, 'public')))
    await cp(join(root, 'public'), join(standalone, 'public'), { recursive: true });
}
