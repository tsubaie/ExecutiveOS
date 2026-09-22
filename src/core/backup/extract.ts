import 'server-only';
import { createReadStream } from 'node:fs';
import { Unpack } from 'tar';
export type ExtractionLimits = { maxBytes: number; maxEntries: number };
// A backup's files.tar only ever holds regular files and directories; anything else is refused
// rather than skipped, so a tampered archive fails the restore instead of restoring partially.
const allowedTypes = new Set(['File', 'OldFile', 'ContiguousFile', 'Directory']);
function refusal(
  entry: object,
  seen: { entries: number; bytes: number },
  limits: ExtractionLimits,
) {
  if (!('type' in entry) || !('size' in entry) || typeof entry.size !== 'number')
    return 'Backup archive entry is unreadable';
  if (typeof entry.type !== 'string' || !allowedTypes.has(entry.type))
    return `Backup archive holds a ${String(entry.type)} entry`;
  seen.entries += 1;
  seen.bytes += entry.size;
  if (seen.entries > limits.maxEntries) return 'Backup archive has too many entries';
  if (seen.bytes > limits.maxBytes) return 'Backup archive expands beyond the allowed size';
  return null;
}
function reason(signal: AbortSignal) {
  return signal.reason instanceof Error ? signal.reason : new Error('Restore aborted');
}
// ADMIN-B32: extraction streams through counters that stop at the first entry past a limit,
// before its bytes are written. Traversal and absolute paths fail through `strict`.
export function extractBounded(
  file: string,
  cwd: string,
  limits: ExtractionLimits,
  signal: AbortSignal,
) {
  return new Promise<{ entries: number; bytes: number }>((resolve, reject) => {
    if (signal.aborted) return reject(reason(signal));
    const seen = { entries: 0, bytes: 0 };
    const source = createReadStream(file);
    const unpack: Unpack = new Unpack({
      cwd,
      strict: true,
      preservePaths: false,
      filter: (_path, entry) => {
        const refused = refusal(entry, seen, limits);
        if (refused) unpack.abort(new Error(refused));
        return !refused;
      },
    });
    const abort = () => unpack.abort(reason(signal));
    const settle = (error?: unknown) => {
      signal.removeEventListener('abort', abort);
      source.destroy();
      if (error === undefined) resolve(seen);
      else reject(error instanceof Error ? error : new Error(String(error)));
    };
    signal.addEventListener('abort', abort, { once: true });
    source.on('error', settle);
    unpack.on('error', settle);
    unpack.on('close', () => settle());
    source.pipe(unpack);
  });
}
