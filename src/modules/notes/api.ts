import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { AppError } from '@/core/http/errors';
import {
  NoteDetail,
  NoteCreate,
  NotePatch,
  NoteList,
  NoteListQuery,
  Revision,
  BulkItems,
  BulkTag,
  BulkResult,
  TagList,
  NoteTypes,
} from './schema/validation';
import * as service from './service';
const noteId = (params: Record<string, string>) => z.uuid().parse(params.id);
const response = z.object({ data: NoteDetail });
export const list = defineHandler({
  guard: 'session',
  input: NoteListQuery,
  response: NoteList,
  handler: (input, ctx) => service.listNotes(authenticated(ctx), input),
});
export const create = defineHandler({
  guard: 'session',
  input: NoteCreate,
  response,
  status: 201,
  idempotent: true,
  handler: async (input, ctx) => ({ data: await service.createNote(authenticated(ctx), input) }),
});
export const detail = defineHandler({
  guard: 'session',
  input: z.strictObject({ includeDeleted: z.enum(['true', 'false']).optional() }),
  response,
  handler: async (input, ctx, params) => ({
    data: await service.getNote(
      authenticated(ctx),
      noteId(params),
      input.includeDeleted === 'true',
    ),
  }),
});
export const patch = defineHandler({
  guard: 'session',
  input: NotePatch,
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.patchNote(authenticated(ctx), noteId(params), input),
  }),
});
export const remove = defineHandler({
  guard: 'session',
  input: Revision,
  response: z.object({ opId: z.uuid() }),
  status: 204,
  handler: (input, ctx, params) =>
    service.removeNote(authenticated(ctx), noteId(params), input.revision),
});
export const restore = defineHandler({
  guard: 'session',
  input: z.strictObject({ opId: z.uuid() }),
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.restoreNote(authenticated(ctx), noteId(params), input.opId),
  }),
});
export const archive = defineHandler({
  guard: 'session',
  input: Revision,
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.archiveNote(authenticated(ctx), noteId(params), input.revision),
  }),
});
export const unarchive = defineHandler({
  guard: 'session',
  input: Revision,
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.unarchiveNote(authenticated(ctx), noteId(params), input.revision),
  }),
});
export const bulkArchive = defineHandler({
  guard: 'session',
  input: BulkItems,
  response: BulkResult,
  idempotent: true,
  handler: (input, ctx) => service.bulkArchive(authenticated(ctx), input),
});
export const bulkTag = defineHandler({
  guard: 'session',
  input: BulkTag,
  response: BulkResult,
  idempotent: true,
  handler: (input, ctx) => service.bulkTag(authenticated(ctx), input),
});
export const types = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: NoteTypes,
  handler: (_input, ctx) => service.listTypes(authenticated(ctx)),
});
export const tags = defineHandler({
  guard: 'session',
  input: z.strictObject({}),
  response: TagList,
  handler: (_input, ctx) => service.listTags(authenticated(ctx)),
});
// NOTES-B17: the AI routes exist and refuse until the capabilities ship (Phase 3b).
const unavailable = defineHandler({
  guard: 'session',
  input: Revision,
  response,
  handler: async () => {
    throw new AppError('ai_unavailable');
  },
});
export const refine = unavailable;
export const suggestTags = unavailable;
