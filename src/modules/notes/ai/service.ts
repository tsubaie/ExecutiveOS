/** NOTES-B17: snapshot inputs and admit explicit, revision-fenced note assistance. */
import 'server-only';
import { type Context } from '@/core/auth/session';
import { AppError } from '@/core/http/errors';
import { admitAi, availableCapabilities } from '@/core/ai/admission';
import { peopleForAi } from '../service';
import { getNote, listTags } from '../service';
import { pendingRefinement, lockNote } from '../repo';
export async function startNoteAi(
  ctx: Context,
  noteId: string,
  revision: number,
  capability: 'notes.refine' | 'notes.suggest_tags',
) {
  if (!(await availableCapabilities(ctx)).includes(capability))
    throw new AppError('ai_unavailable');
  await lockNote(ctx.db, noteId);
  const note = await getNote(ctx, noteId);
  if (!note.content.trim()) throw new AppError('rule_violation', { rule: 'NOTES-B18' });
  if (note.revision !== revision) throw new AppError('conflict', { reason: 'revision' });
  const pending = capability === 'notes.refine' ? await pendingRefinement(ctx.db, noteId) : null;
  if (pending) {
    if (pending.createdBy !== ctx.user.id) throw new AppError('conflict', { reason: 'state' });
    return { id: pending.jobId };
  }
  const tags = await listTags(ctx);
  return admitAi(ctx, capability, noteId, revision, {
    content: note.content,
    title: note.title,
    type: note.type,
    tags: note.tags,
    existingTags: tags.data.map((tag) => tag.tag),
    assignablePeople:
      capability === 'notes.refine'
        ? (await peopleForAi(ctx)).filter((person) => person.isAssignable).map((person) => person.name)
        : [],
  });
}
