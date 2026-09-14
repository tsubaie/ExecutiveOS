import 'server-only';
import { z } from 'zod';
import { type JobHandler } from '@/core/jobs/types';
import { executeAi } from '@/core/ai/execute';
import { AiPayload, AiOutput } from '@/core/ai/job-schema';
import { id } from '@/core/db/ids';
import { RefinementOutput, TagOutput } from './schema/validation';
import { Tags } from './schema/validation';
import { REFINE_PROMPT as REFINE_PROMPT_V1, TAG_PROMPT } from './ai/prompts/refine.v1';
import { REFINE_PROMPT } from './ai/prompts/refine.v2';
import { lockNote, insertRefinement } from './repo';
export const noteJobs: Record<string, JobHandler> = {
  'ai.notes.refine': {
    concurrency: 2,
    schema: AiPayload,
    run: async (job, signal) => {
      const prompt = AiPayload.parse(job.payload).promptVersion === 2 ? REFINE_PROMPT : REFINE_PROMPT_V1;
      const output = await executeAi(job, prompt, RefinementOutput, signal);
      const input = z
        .object({ assignablePeople: z.array(z.string()), content: z.string() })
        .parse(AiPayload.parse(job.payload).input);
      const warnings: string[] = [];
      const suggested_tasks = output.suggested_tasks
        .filter(
          (task, index, all) => all.findIndex((other) => other.title === task.title) === index,
        )
        .map((task) => {
          const owner_name =
            task.owner_name && input.assignablePeople.includes(task.owner_name)
              ? task.owner_name
              : null;
          const due_date =
            task.due_date && z.iso.date().safeParse(task.due_date).success ? task.due_date : null;
          const source_snippet =
            task.source_snippet && input.content.includes(task.source_snippet)
              ? task.source_snippet
              : null;
          if (
            owner_name !== task.owner_name ||
            due_date !== task.due_date ||
            source_snippet !== task.source_snippet
          )
            warnings.push('invalid_task_context');
          return { ...task, owner_name, due_date, source_snippet };
        });
      return {
        output: { ...output, suggested_tasks, suggested_tags: Tags.parse(output.suggested_tags) },
        warnings,
      };
    },
    publish: async (database, job, raw) => {
      const payload = AiPayload.parse(job.payload);
      const output = RefinementOutput.parse(AiOutput.parse(raw).output);
      const note = await lockNote(database, payload.entityId);
      if (!note) return;
      await insertRefinement(database, {
        id: id(),
        noteId: note.id,
        jobId: job.id,
        noteRevision: payload.revision,
        contentHash: payload.contentHash,
        capabilityVersion: 1,
        refinedContent: output.refined_content,
        suggestedTasks: output.suggested_tasks,
        suggestedTags: output.suggested_tags,
        summaryOfChanges: output.summary_of_changes,
        status: note.revision === payload.revision && !note.deletedAt ? 'pending' : 'stale',
        createdBy: job.createdBy,
      });
    },
  },
  'ai.notes.suggest_tags': {
    concurrency: 2,
    schema: AiPayload,
    run: async (job, signal) => {
      const output = await executeAi(job, TAG_PROMPT, TagOutput, signal);
      return { output: { tags: Tags.parse(output.tags) }, warnings: [] };
    },
    publish: async () => {},
  },
};
