import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { db, pool } from '../../src/core/db/client';
import { User } from '../../src/core/auth/validation';
import { id } from '../../src/core/db/ids';
import { getSetting, writeSetting } from '../../src/core/db/settings-repo';
import { dayAt } from '../../src/core/time/days';
import { selectUsers } from '../../src/modules/users/repo';
import {
  DefaultType,
  NoteCreate,
  NoteListQuery,
  Tags,
  type NoteType,
} from '../../src/modules/notes/schema/validation';
import { archiveNote, createNote, listNotes, noteTypes } from '../../src/modules/notes/service';
import type { Context } from '../../src/core/auth/session';
// Imports the `notion_notes` rows of a Mission Control `pg_dump` (plain SQL) as standalone notes
// (docs/03 § Import from legacy Mission Control). Every legacy note becomes one note; threads are
// only consulted for a missing title (ADR 0012). Legacy types that are not one of the six defaults
// are registered as enabled note types so nothing is lost; the maintainer can rename or disable
// them on Administration → Note types. A note whose title and date already exist is skipped, so
// the script can be re-run. Usage: `node --conditions=react-server --import tsx
// scripts/db/import-mission-control-notes.ts <path/to/database.sql>`.
const [, , file] = process.argv;
if (!file) throw new Error('Pass the path of the Mission Control database.sql');
const sql = await readFile(file, 'utf8');
// PostgreSQL COPY text format: one row per line, tab-separated, `\N` for null, backslash escapes.
function unescapeCopy(field: string) {
  if (field === '\\N') return null;
  return field.replace(/\\(.)/gu, (_, char: string) => {
    const known: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v' };
    return known[char] ?? char;
  });
}
function copyRows(table: string) {
  const start = sql.indexOf(`COPY public.${table} (`);
  if (start < 0) return [];
  const body = sql.slice(sql.indexOf('\n', start) + 1, sql.indexOf('\n\\.', start));
  return body.split('\n').map((line) => line.split('\t').map(unescapeCopy));
}
// A PostgreSQL text[] literal: `{}` or comma-separated items, quoted when they contain spaces.
function arrayLiteral(value: string | null) {
  if (!value || value === '{}') return [];
  const items: string[] = [];
  const pattern = /"((?:[^"\\]|\\.)*)"|([^,{}]+)/gu;
  for (const match of value.slice(1, -1).matchAll(pattern))
    items.push((match[1] ?? match[2] ?? '').replace(/\\(.)/gu, '$1').trim());
  return items.filter(Boolean);
}
const LegacyNote = z.object({
  noteId: z.string(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  type: z.string().nullable(),
  date: z.string().nullable(),
  createdTime: z.string().nullable(),
  archived: z.enum(['t', 'f']),
  tags: z.array(z.string()),
  threadId: z.string(),
});
type LegacyNote = z.infer<typeof LegacyNote>;
const legacyNotes = copyRows('notion_notes').map((row) =>
  LegacyNote.parse({
    noteId: row[0],
    title: row[1],
    content: row[2],
    type: row[3],
    date: row[4],
    createdTime: row[5],
    archived: row[7],
    tags: arrayLiteral(row[8] ?? null),
    threadId: row[14],
  }),
);
const threadTitles = new Map(copyRows('note_threads').map((row) => [row[0], row[1]]));
const known: Record<string, string> = {
  'board meeting': 'board_meeting',
  'executive meeting': 'executive_meeting',
  'sector meeting': 'sector_meeting',
  'one on one': 'one_on_one',
  personal: 'personal',
  others: 'other',
  other: 'other',
};
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 50) || 'legacy';
function typeIdFor(legacy: string | null) {
  if (!legacy) return null;
  return known[legacy.trim().toLowerCase()] ?? slug(legacy);
}
const user = (await selectUsers(db())).find((user) => user.role === 'admin' && user.isActive);
if (!user) throw new Error('Complete setup before importing notes.');
const summary: { imported: number; skipped: number; archived: number; typesAdded: string[] } = {
  imported: 0,
  skipped: 0,
  archived: 0,
  typesAdded: [],
};
// Register legacy types the workspace does not have yet, keeping the legacy label for both locales.
async function registerTypes(ctx: Context) {
  const wanted = new Map<string, string>();
  for (const note of legacyNotes) {
    const typeId = typeIdFor(note.type);
    if (typeId && note.type && !DefaultType.safeParse(typeId).success)
      wanted.set(typeId, note.type.trim());
  }
  const configured = await noteTypes(ctx);
  const missing = [...wanted].filter(([typeId]) => !configured.some((type) => type.id === typeId));
  if (!missing.length) return;
  const complete = (type: NoteType) => ({
    id: type.id,
    labels: { en: type.labels?.en ?? type.id, ar: type.labels?.ar ?? type.id },
    enabled: type.enabled,
  });
  await writeSetting(
    ctx.db,
    'notes.types',
    [
      ...configured.map(complete),
      ...missing.map(([typeId, label]) => ({
        id: typeId,
        labels: { en: label, ar: label },
        enabled: true,
      })),
    ],
    ctx.user.id,
  );
  summary.typesAdded = missing.map(([typeId]) => typeId);
}
async function alreadyImported(ctx: Context, title: string, noteDate: string) {
  const found = await listNotes(
    ctx,
    NoteListQuery.parse({ q: title.slice(0, 500), from: noteDate, to: noteDate, limit: 200 }),
  );
  return found.data.some((note) => note.title === title);
}
async function importNote(ctx: Context, note: LegacyNote, timezone: string) {
  const title = (
    note.title?.trim() ||
    threadTitles.get(note.threadId)?.trim() ||
    `Untitled ${note.noteId.slice(0, 8)}`
  ).slice(0, 500);
  const when = note.date ?? note.createdTime;
  const noteDate = when ? dayAt(timezone, new Date(when).toISOString()) : dayAt(timezone);
  if (await alreadyImported(ctx, title, noteDate)) {
    summary.skipped += 1;
    return;
  }
  const created = await createNote(
    ctx,
    NoteCreate.parse({
      title,
      content: (note.content ?? '').slice(0, 50000),
      type: typeIdFor(note.type),
      noteDate,
      tags: Tags.parse(note.tags.map((tag) => tag.slice(0, 50)).slice(0, 10)),
    }),
  );
  summary.imported += 1;
  if (note.archived === 't') {
    await archiveNote(ctx, created.id, created.revision);
    summary.archived += 1;
  }
}
await db().transaction(async (database) => {
  const ctx: Context = { db: database, user: User.parse(user), requestId: id() };
  const timezone = await getSetting(database, 'workspace.timezone');
  await registerTypes(ctx);
  for (const note of legacyNotes) await importNote(ctx, note, timezone);
});
process.stdout.write(`${JSON.stringify(summary)}\n`);
await pool().end();
