/** NOTES-I01–I07, B01–B16: standalone notes with participants, tags, linked tasks and archive. */
import 'server-only';
import { z } from 'zod';
import type { Context } from '@/core/auth/session';
import { id } from '@/core/db/ids';
import { toJson, writeAudit } from '@/core/db/audit-repo';
import { getSetting } from '@/core/db/settings-repo';
import { decodeCursor, encodeCursor, filtersHash } from '@/core/db/keyset';
import { applyUpdate, requireRevision, restoreByOp, type EntityOps } from '@/core/entity/service';
import { AppError } from '@/core/http/errors';
import { routes } from '@/core/routes';
import type { HomeSection } from '@/core/modules/server-manifest';
import { dayAt, addDays, bandOf } from '@/core/time/notes';
import { getPerson } from '@/modules/people';
import en from '@/core/i18n/messages/en.json';
import ar from '@/core/i18n/messages/ar.json';
import {
  Note,
  NoteDetail,
  Counts,
  defaultTypes,
  type NoteType,
  type NoteCreate,
  type NotePatch,
  type NoteListQuery,
  type BulkItems,
  type BulkTag,
} from './schema/validation';
import * as repo from './repo';
type NoteRow = NonNullable<Awaited<ReturnType<typeof repo.updateNote>>>;
type Patch = Parameters<typeof repo.updateNote>[3];
const ops: EntityOps<NoteDetail, NoteRow, Patch> = {
  entityType: 'note',
  get: (ctx, noteId, includeDeleted) => getNote(ctx, noteId, includeDeleted),
  update: (ctx, noteId, revision, patch) =>
    repo.updateNote(ctx.db, noteId, revision, patch, ctx.user.id),
  restore: (ctx, noteId, opId) => repo.restoreNote(ctx.db, noteId, opId, ctx.user.id),
};
// NOTES-I02: the configured types, or the six defaults while nothing is configured.
export async function noteTypes(ctx: Context): Promise<NoteType[]> {
  const configured = await getSetting(ctx.db, 'notes.types');
  if (configured.length) return configured;
  return defaultTypes.map((typeId) => ({
    id: typeId,
    labels: { en: en.notes[typeId], ar: ar.notes[typeId] },
    enabled: true,
  }));
}
const enabledIds = (types: NoteType[]) =>
  types.filter((type) => type.enabled).map((type) => type.id);
export function viewsFor(typeIds: string[]): string[] {
  return ['all', 'this_week', ...typeIds.map((typeId) => `type:${typeId}`), 'archived', 'trash'];
}
// NOTES-I02: null is always allowed; a type must be enabled.
function requireType(types: NoteType[], type: string | null) {
  if (type !== null && !enabledIds(types).includes(type))
    throw new AppError('rule_violation', { rule: 'NOTES-I02' });
}
async function defaultType(ctx: Context, types: NoteType[]) {
  const configured = await getSetting(ctx.db, 'notes.default_type');
  return configured && enabledIds(types).includes(configured) ? configured : null;
}
async function requirePeople(ctx: Context, personIds: string[]) {
  for (const personId of personIds) await getPerson(ctx, personId);
}
async function today(ctx: Context) {
  const timezone = await getSetting(ctx.db, 'workspace.timezone');
  return { timezone, today: dayAt(timezone) };
}
export async function listNotes(ctx: Context, query: NoteListQuery) {
  const clock = await today(ctx);
  const types = await noteTypes(ctx);
  const views = viewsFor(enabledIds(types));
  if (!views.includes(query.view))
    throw new AppError('validation_failed', { fieldErrors: { view: ['unknown_view'] } });
  const { cursor, limit, ...filters } = query;
  const hash = filtersHash(z.json().parse({ ...filters, ...clock }));
  const spec = repo.sortSpec(query.sort);
  const dates = { today: clock.today, weekStart: addDays(clock.today, -6) };
  const rows = await repo.selectNotes(
    ctx.db,
    query,
    dates,
    views,
    spec,
    limit + 1,
    decodeCursor(cursor, spec, hash),
  );
  const counts = Counts.parse(
    rows[0]?.counts ?? (await repo.countNotes(ctx.db, query, dates, views)),
  );
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    data: page.map((row) => Note.parse({ ...row, band: bandOf(row.noteDate, clock.today) })),
    meta: {
      counts,
      total: counts[query.view] ?? 0,
      nextCursor: rows.length > limit && last ? encodeCursor(spec, hash, last) : null,
      types,
      ...clock,
    },
  };
}
export async function getNote(ctx: Context, noteId: string, deleted = false) {
  const row = await repo.selectNote(ctx.db, noteId);
  if (!row || (!deleted && row.deletedAt)) throw new AppError('not_found', { entityType: 'note' });
  return NoteDetail.parse({ ...row, tasks: await repo.selectNoteTasks(ctx.db, noteId) });
}
export async function createNote(ctx: Context, input: NoteCreate) {
  const types = await noteTypes(ctx);
  const type = input.type ?? (await defaultType(ctx, types));
  requireType(types, type);
  await requirePeople(ctx, input.participantIds);
  const { participantIds, noteDate, ...fields } = input;
  const row = await repo.insertNote(ctx.db, {
    ...fields,
    id: id(),
    type,
    noteDate: noteDate ?? (await today(ctx)).today,
    createdBy: ctx.user.id,
    updatedBy: ctx.user.id,
  });
  await repo.insertParticipants(ctx.db, row.id, participantIds, ctx.user.id);
  await writeAudit(ctx.db, ctx.user.id, 'create', 'note', row.id, toJson(input));
  return getNote(ctx, row.id);
}
// NOTES-B07: `participantIds` replaces the set; rows removed are soft-deleted under one op id.
async function setParticipants(ctx: Context, noteId: string, personIds: string[]) {
  await requirePeople(ctx, personIds);
  const current = await repo.activeParticipantIds(ctx.db, noteId);
  const removed = current.filter((personId) => !personIds.includes(personId));
  const added = personIds.filter((personId) => !current.includes(personId));
  await repo.removeParticipants(ctx.db, noteId, removed, id());
  await repo.insertParticipants(ctx.db, noteId, added, ctx.user.id);
}
export async function patchNote(ctx: Context, noteId: string, input: NotePatch) {
  const note = await requireRevision(ctx, ops, noteId, input.revision);
  if (input.type !== undefined) requireType(await noteTypes(ctx), input.type);
  const { revision, participantIds, ...fields } = input;
  void revision;
  if (participantIds) await setParticipants(ctx, noteId, participantIds);
  await applyUpdate(ctx, ops, note, fields, { diff: toJson({ ...fields, participantIds }) });
  return getNote(ctx, noteId);
}
async function setArchived(ctx: Context, noteId: string, revision: number, archived: boolean) {
  const note = await requireRevision(ctx, ops, noteId, revision);
  if (Boolean(note.archivedAt) !== archived)
    await applyUpdate(
      ctx,
      ops,
      note,
      { archivedAt: archived ? new Date() : null },
      { action: archived ? 'archive' : 'unarchive' },
    );
  return getNote(ctx, noteId);
}
export const archiveNote = (ctx: Context, noteId: string, revision: number) =>
  setArchived(ctx, noteId, revision, true);
export const unarchiveNote = (ctx: Context, noteId: string, revision: number) =>
  setArchived(ctx, noteId, revision, false);
export async function removeNote(ctx: Context, noteId: string, revision: number) {
  const note = await requireRevision(ctx, ops, noteId, revision);
  const opId = id();
  await applyUpdate(
    ctx,
    ops,
    note,
    { deletedAt: new Date(), deletedOpId: opId },
    { action: 'delete', opId, diff: {} },
  );
  return { opId };
}
export async function restoreNote(ctx: Context, noteId: string, opId: string) {
  await restoreByOp(ctx, ops, noteId, opId);
  return getNote(ctx, noteId);
}
// NOTES-B12: every item is checked before anything changes; a throw rolls the transaction back.
async function bulkNotes(
  ctx: Context,
  input: BulkItems,
  change: (note: NoteDetail) => Patch | null,
  action: string,
) {
  const updatedIds: string[] = [];
  for (const item of input.items) {
    const note = await getNote(ctx, item.id);
    if (note.revision !== item.revision)
      throw new AppError('conflict', { reason: 'revision', id: item.id });
    const patch = change(note);
    if (!patch) continue;
    await applyUpdate(ctx, ops, note, patch, { action });
    updatedIds.push(note.id);
  }
  return { data: { updatedIds } };
}
export function bulkArchive(ctx: Context, input: BulkItems) {
  return bulkNotes(
    ctx,
    input,
    (note) => (note.archivedAt ? null : { archivedAt: new Date() }),
    'archive',
  );
}
export function bulkTag(ctx: Context, input: BulkTag) {
  const lower = input.tag.toLowerCase();
  return bulkNotes(
    ctx,
    input,
    (note) => {
      if (note.tags.some((tag) => tag.toLowerCase() === lower)) return null;
      if (note.tags.length >= 10)
        throw new AppError('rule_violation', { rule: 'NOTES-I03', id: note.id });
      return { tags: [...note.tags, input.tag] };
    },
    'tag',
  );
}
export async function listTypes(ctx: Context) {
  const types = await noteTypes(ctx);
  return { data: types, meta: { defaultType: await defaultType(ctx, types) } };
}
export async function listTags(ctx: Context) {
  return { data: await repo.selectTags(ctx.db) };
}
export async function homeSummary(ctx: Context): Promise<HomeSection[]> {
  const clock = await today(ctx);
  const row = await repo.selectRecent(ctx.db, addDays(clock.today, -6), clock.today);
  return [
    {
      key: 'notes',
      enabled: true,
      count: z.number().parse(row.count),
      href: routes.notes({ view: 'this_week' }),
      items: z
        .array(z.object({ id: z.uuid(), title: z.string() }))
        .parse(row.items)
        .map((item) => ({ ...item, href: routes.notes({ view: 'all', id: item.id }) })),
    },
  ];
}
