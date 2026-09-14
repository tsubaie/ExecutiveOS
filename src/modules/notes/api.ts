import type { Context } from '@/core/auth/session';
import { createTask } from '@/modules/tasks';
import { TaskCreate } from '@/modules/tasks/schema/validation';
import { SuggestedTask } from './schema/validation';
import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { startNoteAi } from './ai/service';
import { noteAiApplyHandler, noteAiDiscardHandler } from './ai/api';
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
import { listManagedTags, manageTags } from './service';
import { ManageTags, ManageTagsResult } from './schema/validation';
export const managedTags = defineHandler({
  guard: 'admin', input: z.strictObject({}), response: TagList,
  handler: (_, ctx) => listManagedTags(authenticated(ctx)),
});
export const manageTagSelection = defineHandler({
  guard: 'admin', input: ManageTags, response: ManageTagsResult, idempotent: true,
  handler: (input, ctx) => manageTags(authenticated(ctx), input),
});
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
function noteAiStart(capability: 'notes.refine' | 'notes.suggest_tags') {
  return defineHandler({
    guard: 'session',
    input: Revision,
    response: z.object({ data: z.object({ id: z.uuid() }) }),
    status: 202,
    handler: async (input, ctx, params) => ({
      data: await startNoteAi(authenticated(ctx), noteId(params), input.revision, capability),
    }),
  });
}
export const refine = noteAiStart('notes.refine');
export const suggestTags = noteAiStart('notes.suggest_tags');
export const refineApply = noteAiApplyHandler('notes.refine', createSuggestedTask);
export const tagsApply = noteAiApplyHandler('notes.suggest_tags', createSuggestedTask);
export const refineDiscard = noteAiDiscardHandler('notes.refine');
export const tagsDiscard = noteAiDiscardHandler('notes.suggest_tags');

async function createSuggestedTask(ctx: Context, noteId: string, task: z.infer<typeof SuggestedTask>, ownerId: string | null) {
  const row = await createTask(ctx, TaskCreate.parse({ title: task.title, description: task.description,
    status: task.status, priority: task.priority, dueDate: task.due_date, sourceNoteId: noteId, ownerId }));
  return row.id;
}
