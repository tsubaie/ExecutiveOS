import 'server-only';
import { z } from 'zod';
import { digest } from '@/core/auth/password';
import { AppError } from './errors';
const Cursor = z.object({
  v: z.literal(1),
  sort: z.string(),
  filtersHash: z.string(),
  last: z.tuple([z.string(), z.uuid()]),
});
export function filtersHash(value: z.infer<ReturnType<typeof z.json>>) {
  return digest(JSON.stringify(value));
}
export function readCursor(cursor: string | undefined, hash: string) {
  if (!cursor) return undefined;
  try {
    const parsed = Cursor.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    if (parsed.filtersHash !== hash || parsed.sort !== 'name') throw new Error('Cursor mismatch');
    return { name: parsed.last[0], id: parsed.last[1] };
  } catch {
    throw new AppError('validation_failed', { fieldErrors: { cursor: ['cursor_mismatch'] } });
  }
}
export function makeCursor(name: string, id: string, hash: string) {
  return Buffer.from(
    JSON.stringify({ v: 1, sort: 'name', filtersHash: hash, last: [name.toLowerCase(), id] }),
  ).toString('base64url');
}
