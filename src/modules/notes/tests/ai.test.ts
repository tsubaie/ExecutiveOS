import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/core/db/client';
import { migrateDatabase } from '@/core/db/migrate';
import { writeSetting } from '@/core/db/settings-repo';
import { createTask } from '@/modules/tasks';
import { TaskCreate } from '@/modules/tasks/schema/validation';
import { fixtureModel, finishedJob } from '../../../../tests/fixtures/ai/jobs';
import refinement from '../../../../tests/fixtures/ai/notes.refine.v1.en.json';
import { harness, actorId } from './fixtures';
import { startNoteAi } from '../ai/service';
import { refinePrompt } from '../ai/prompts/select';
import { NoteAiApply } from '../schema/validation';
import { insertRefinement } from '../repo';
import { id } from '@/core/db/ids';
import { AiPayload } from '@/core/ai/job-schema';
import { latestAiJob } from '@/core/db/ai-jobs-repo';
import { applyNoteAi, discardNoteAi, restoreNoteAi } from '../ai/apply';
import { getNote, patchNote } from '../service';
vi.mock('@/core/ai/models', () => ({ loadModels: async () => [fixtureModel] }));
vi.mock('@/core/ai/client', () => ({ aiConnection: () => ({ state: 'enabled' }) }));
beforeAll(() => migrateDatabase());
beforeEach(async () => {
  await harness.reset();
  await db().execute(sql`truncate jobs, ai_invocations cascade`);
  await writeSetting(db(), 'ai.model.default', fixtureModel.id, actorId());
  await writeSetting(db(), 'ai.model.fast', fixtureModel.id, actorId());
});
afterAll(() => pool().end());
it('NOTES-B17 applies reviewed content, tags and tasks atomically and once', async () => {
  const person = await harness.person('Alex', { isAssignable: true });
  const note = await harness.note('Plan', { content: 'Review the draft with @Alex.' });
  const job = await finishedJob(
    db(),
    actorId(),
    'notes.refine',
    note.id,
    note.revision,
    refinement,
  );
  const apply = () =>
    harness.run((ctx) =>
      applyNoteAi(
        ctx,
        note.id,
        { jobId: job.id, acceptContent: true, taskIndexes: [0], tagIndexes: [0] },
        'notes.refine',
        async (task, ownerId) =>
          (
            await createTask(
              ctx,
              TaskCreate.parse({ title: task.title, ownerId, sourceNoteId: note.id }),
            )
          ).id,
      ),
    );
  const first = await apply();
  expect(await apply()).toEqual(first);
  const updated = await harness.run((ctx) => getNote(ctx, note.id));
  expect(updated.content).toBe(refinement.refined_content);
  expect(updated.tags).toEqual(['planning']);
  expect(updated.tasks).toHaveLength(1);
  expect(updated.participants.map((item) => item.id)).toEqual([person.id]);
});
it('NOTES-B17 rejects stale suggestions without creating tasks or replacing content', async () => {
  const note = await harness.note('Plan');
  const job = await finishedJob(
    db(),
    actorId(),
    'notes.refine',
    note.id,
    note.revision,
    refinement,
  );
  await harness.run((ctx) =>
    patchNote(ctx, note.id, { revision: note.revision, content: 'Edited' }),
  );
  const create = vi.fn();
  await expect(
    harness.run((ctx) =>
      applyNoteAi(
        ctx,
        note.id,
        { jobId: job.id, acceptContent: true, taskIndexes: [0], tagIndexes: [] },
        'notes.refine',
        create,
      ),
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(create).not.toHaveBeenCalled();
  expect((await harness.run((ctx) => getNote(ctx, note.id))).content).toBe('Edited');
});
it('NOTES-B17 NOTES-A10 disabled capabilities refuse both note entry points', async () => {
  const note = await harness.note('Disabled');
  await writeSetting(db(), 'ai.enabled_capabilities', [], actorId());
  for (const capability of ['notes.refine', 'notes.suggest_tags'] as const)
    await expect(
      harness.run((ctx) => startNoteAi(ctx, note.id, note.revision, capability)),
    ).rejects.toMatchObject({ code: 'ai_unavailable' });
});
it('NOTES-B18 applies edited task titles and preserves repeat-apply protection', async () => {
  const note = await harness.note('Plan', { content: 'Review the draft.' });
  const job = await finishedJob(
    db(),
    actorId(),
    'notes.refine',
    note.id,
    note.revision,
    refinement,
  );
  const create = vi.fn().mockResolvedValue('00000000-0000-4000-8000-000000000001');
  const input = {
    jobId: job.id,
    acceptContent: true,
    taskIndexes: [0],
    tagIndexes: [],
    taskTitles: [{ index: 0, title: 'Review the revised draft' }],
  };
  const apply = () =>
    harness.run((ctx) => applyNoteAi(ctx, note.id, input, 'notes.refine', create));
  const first = await apply();
  expect(await apply()).toEqual(first);
  expect(create).toHaveBeenCalledTimes(1);
  expect(create.mock.calls[0]?.[0]).toMatchObject({ title: 'Review the revised draft' });
});
it('NOTES-B18 Apply Note Only updates content and selected tags without creating tasks', async () => {
  const note = await harness.note('Plan', { content: 'Review the draft.' });
  const job = await finishedJob(
    db(),
    actorId(),
    'notes.refine',
    note.id,
    note.revision,
    refinement,
  );
  const create = vi.fn();
  await harness.run((ctx) =>
    applyNoteAi(
      ctx,
      note.id,
      {
        jobId: job.id,
        acceptContent: true,
        taskIndexes: [],
        tagIndexes: [0],
        taskTitles: [],
      },
      'notes.refine',
      create,
    ),
  );
  expect(create).not.toHaveBeenCalled();
  const updated = await harness.run((ctx) => getNote(ctx, note.id));
  expect(updated.content).toBe(refinement.refined_content);
  expect(updated.tags).toContain('planning');
});
it('NOTES-B26 refine jobs are admitted with prompt v3, which keeps checklist markers out of refined content, and older versions stay executable', async () => {
  const note = await harness.note('Plan', { content: 'Review the draft.' });
  const started = await harness.run((ctx) =>
    startNoteAi(ctx, note.id, note.revision, 'notes.refine'),
  );
  const job = await latestAiJob(db(), actorId(), note.id, 'ai.notes.refine');
  expect(job?.id).toBe(started.id);
  expect(AiPayload.parse(job?.payload).promptVersion).toBe(3);
  expect(refinePrompt(3)).toMatch(/never write checklist markers/iu);
  expect(refinePrompt(3)).toMatch(/keep any checklist marker that already exists/iu);
  expect(refinePrompt(3)).toMatch(/level two/iu);
  expect(refinePrompt(2)).not.toMatch(/checklist/iu);
  expect(refinePrompt(1)).not.toMatch(/checklist/iu);
  expect(refinePrompt(2)).not.toBe(refinePrompt(3));
});
it('NOTES-B18 Keep applies the rewrite as the reader edited it, and an edit without accepting content is refused', async () => {
  const note = await harness.note('Plan', { content: 'Review the draft.' });
  const job = await finishedJob(
    db(),
    actorId(),
    'notes.refine',
    note.id,
    note.revision,
    refinement,
  );
  await harness.run((ctx) =>
    applyNoteAi(
      ctx,
      note.id,
      {
        jobId: job.id,
        acceptContent: true,
        content: '## Edited\n\nBy hand.',
        taskIndexes: [],
        tagIndexes: [],
      },
      'notes.refine',
      async () => '00000000-0000-4000-8000-000000000001',
    ),
  );
  expect((await harness.run((ctx) => getNote(ctx, note.id))).content).toBe('## Edited\n\nBy hand.');
  expect(
    NoteAiApply.safeParse({
      jobId: job.id,
      acceptContent: false,
      content: 'x',
      taskIndexes: [],
      tagIndexes: [0],
    }).success,
  ).toBe(false);
});
it('NOTES-B18 a discarded proposal can be restored until it is applied, and comes back stale when the note moved on', async () => {
  const note = await harness.note('Plan', { content: 'Review the draft.' });
  const job = await finishedJob(
    db(),
    actorId(),
    'notes.refine',
    note.id,
    note.revision,
    refinement,
  );
  await harness.run((ctx) => discardNoteAi(ctx, note.id, job.id, 'notes.refine'));
  await expect(
    harness.run((ctx) =>
      applyNoteAi(
        ctx,
        note.id,
        { jobId: job.id, acceptContent: true, taskIndexes: [], tagIndexes: [] },
        'notes.refine',
        async () => 'x',
      ),
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  await harness.run((ctx) => restoreNoteAi(ctx, note.id, job.id));
  const applied = await harness.run((ctx) =>
    applyNoteAi(
      ctx,
      note.id,
      { jobId: job.id, acceptContent: true, taskIndexes: [], tagIndexes: [] },
      'notes.refine',
      async () => 'x',
    ),
  );
  expect(applied.ids).toEqual([]);
  await expect(harness.run((ctx) => restoreNoteAi(ctx, note.id, job.id))).rejects.toMatchObject({
    code: 'conflict',
  });
  // A second proposal, discarded after the note moved on, restores as stale rather than pending.
  const moved = await harness.run((ctx) => getNote(ctx, note.id));
  const later = await finishedJob(
    db(),
    actorId(),
    'notes.refine',
    note.id,
    moved.revision,
    refinement,
  );
  await insertRefinement(db(), {
    id: id(),
    noteId: note.id,
    jobId: later.id,
    noteRevision: moved.revision,
    contentHash: 'fixture',
    capabilityVersion: 1,
    refinedContent: refinement.refined_content,
    suggestedTasks: refinement.suggested_tasks,
    suggestedTags: refinement.suggested_tags,
    summaryOfChanges: refinement.summary_of_changes,
    status: 'pending',
    createdBy: actorId(),
  });
  await harness.run((ctx) =>
    patchNote(ctx, note.id, { revision: moved.revision, title: 'Plan 2' }),
  );
  await harness.run((ctx) => discardNoteAi(ctx, note.id, later.id, 'notes.refine'));
  await harness.run((ctx) => restoreNoteAi(ctx, note.id, later.id));
  const rows = await db().execute(
    sql`select status from note_refinements where job_id = ${later.id}::uuid`,
  );
  expect(rows.rows[0]?.status).toBe('stale');
});
