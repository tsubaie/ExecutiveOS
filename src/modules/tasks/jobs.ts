import 'server-only';
import { z } from 'zod';
import { type JobHandler } from '@/core/jobs/types';
import { executeAi } from '@/core/ai/execute';
import { AiPayload } from '@/core/ai/job-schema';
import { BreakdownOutput } from './schema/validation';
import { BREAKDOWN_PROMPT } from './ai/prompts/breakdown.v1';
export const taskJobs: Record<string, JobHandler> = {
  'ai.tasks.breakdown': {
    concurrency: 2,
    schema: AiPayload,
    run: async (job, signal) => {
      const output = await executeAi(job, BREAKDOWN_PROMPT, BreakdownOutput, signal);
      const source = z
        .object({ dueDate: z.string().nullable() })
        .parse(AiPayload.parse(job.payload).input);
      const warnings: string[] = [];
      const subtasks = output.subtasks
        .filter(
          (task, index, all) => all.findIndex((other) => other.title === task.title) === index,
        )
        .map((task) => {
          if (
            task.dueDate &&
            (!z.iso.date().safeParse(task.dueDate).success ||
              (source.dueDate && task.dueDate > source.dueDate))
          ) {
            warnings.push('invalid_due_date');
            return { ...task, dueDate: null };
          }
          return task;
        });
      return { output: { subtasks }, warnings };
    },
    publish: async () => {},
  },
};
