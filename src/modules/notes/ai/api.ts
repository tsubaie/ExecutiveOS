import 'server-only';
import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import type { Context } from '@/core/auth/session';
import { SuggestedTask } from '../schema/validation';
type CreateSuggestedTask = (ctx: Context, noteId: string, task: z.infer<typeof SuggestedTask>, ownerId: string | null) => Promise<string>;
import { NoteAiApply } from '../schema/validation';
import { applyNoteAi, discardNoteAi } from './apply';
const response = z.object({ data: z.object({ ids: z.array(z.uuid()) }) });
export function noteAiApplyHandler(capability: 'notes.refine' | 'notes.suggest_tags', createSuggestedTask: CreateSuggestedTask) {
  return defineHandler({
    guard: 'session',
    input: NoteAiApply,
    response,
    idempotent: true,
    handler: async (input, ctx, params) => {
      const context = authenticated(ctx);
      const noteId = z.uuid().parse(params.id);
      const data = await applyNoteAi(context, noteId, input, capability,
        (task, ownerId) => createSuggestedTask(context, noteId, task, ownerId));
      return { data };
    },
  });
}
export function noteAiDiscardHandler(capability: 'notes.refine' | 'notes.suggest_tags') {
  return defineHandler({
    guard: 'session',
    input: z.strictObject({ jobId: z.uuid() }),
    response,
    handler: async (input, ctx, params) => ({
      data: await discardNoteAi(
        authenticated(ctx),
        z.uuid().parse(params.id),
        input.jobId,
        capability,
      ),
    }),
  });
}
