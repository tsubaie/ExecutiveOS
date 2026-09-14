/** NOTES-B17: only explicit review writes notes and tasks, atomically and once. */
import 'server-only';
import { z } from 'zod';
import { type Context } from '@/core/auth/session';
import { AppError } from '@/core/http/errors';
import { applied, reviewJob } from '@/core/ai/review';
import { updateAiResult } from '@/core/db/ai-jobs-repo';
import { peopleForAi } from '../service';
import { getNote, patchNote } from '../service';
import { Tags } from '../schema/validation';
import { NoteAiApply, RefinementOutput, TagOutput, SuggestedTask } from '../schema/validation';
import { derivedParticipants } from '../schema/validation';
import { lockNote, reviewRefinement } from '../repo';
type CreateTask = (task: z.infer<typeof SuggestedTask>, ownerId: string | null) => Promise<string>;
function selected<T>(values: T[], indexes: number[]) {
  return indexes.map((index) => {
    const value = values[index];
    if (value === undefined) throw new AppError('validation_failed');
    return value;
  });
}
export async function applyNoteAi(
  ctx: Context,
  noteId: string,
  input: z.infer<typeof NoteAiApply>,
  capability: 'notes.refine' | 'notes.suggest_tags',
  createTask: CreateTask,
) {
  const { payload, result } = await reviewJob(ctx, input.jobId, noteId, capability);
  if (result.appliedIds) return { ids: result.appliedIds };
  await lockNote(ctx.db, noteId);
  const note = await getNote(ctx, noteId);
  if (note.revision !== payload.revision) throw new AppError('conflict', { reason: 'revision' });
  const { refined, chosenTags, chosenTasks } = choices(result.output, capability, input);
  const people = await peopleForAi(ctx);
  const content = input.acceptContent && refined ? refined.refined_content : note.content;
  const mergedTags = [...note.tags, ...chosenTags].filter(
    (tag, index, all) =>
      all.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) === index,
  );
  if (mergedTags.length > 10) throw new AppError('rule_violation', { rule: 'NOTES-I03' });
  const ids: string[] = [];
  for (const task of chosenTasks) {
    ids.push(await createTask(task, ownerFor(task.owner_name, people)));
  }
  await patchNote(ctx, noteId, {
    revision: note.revision,
    content,
    tags: Tags.parse(mergedTags),
    participantIds: derivedParticipants(content, people),
  });
  await applied(ctx, input.jobId, result, ids);
  if (refined) await reviewRefinement(ctx.db, input.jobId, 'applied', ctx.user.id, ids);
  return { ids };
}
export async function discardNoteAi(
  ctx: Context,
  noteId: string,
  jobId: string,
  capability: 'notes.refine' | 'notes.suggest_tags',
) {
  const { result } = await reviewJob(ctx, jobId, noteId, capability);
  if (result.appliedIds) throw new AppError('conflict', { reason: 'state' });
  await updateAiResult(ctx.db, jobId, { ...result, discarded: true });
  if (capability === 'notes.refine')
    await reviewRefinement(ctx.db, jobId, 'discarded', ctx.user.id);
  return { ids: [] };
}

function choices(
  output: z.infer<ReturnType<typeof z.json>>,
  capability: string,
  input: z.infer<typeof NoteAiApply>,
) {
  const refined = capability === 'notes.refine' ? RefinementOutput.parse(output) : null;
  const tags = refined?.suggested_tags ?? TagOutput.parse(output).tags;
  if (!refined && (input.acceptContent || input.taskIndexes.length))
    throw new AppError('validation_failed');
  const chosenTags = selected(tags, input.tagIndexes);
  const chosenTasks = selected(refined?.suggested_tasks ?? [], input.taskIndexes).map((task, position) => ({
    ...task,
    title: input.taskTitles?.find((edit) => edit.index === input.taskIndexes[position])?.title ?? task.title,
  }));
  if (!input.acceptContent && !chosenTags.length && !chosenTasks.length)
    throw new AppError('validation_failed');
  return { refined, chosenTags, chosenTasks };
}
function ownerFor(
  name: string | null,
  people: { id: string; name: string; isAssignable: boolean }[],
) {
  const matches = people.filter((person) => person.isAssignable && person.name === name);
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}
