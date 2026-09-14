/** TASKS-B13: eligibility, source revision, explicit selection and apply-once protection. */
import 'server-only';
import { z } from 'zod';
import { type Context } from '@/core/auth/session';
import { AppError } from '@/core/http/errors';
import { admitAi } from '@/core/ai/admission';
import { applied, reviewJob } from '@/core/ai/review';
import { peopleForAi } from '../service';
import { lockTasks } from '../repo';
import { getTask, createTask, patchTask } from '../service';
import { TaskCreate, type TaskDetail } from '../schema/validation';
import { BreakdownApply, BreakdownOutput } from '../schema/validation';
function eligible(task: TaskDetail) {
  if (task.parentId || task.status === 'completed' || task.subtasks.length)
    throw new AppError('rule_violation', { rule: 'TASKS-B13' });
}
export async function startBreakdown(ctx: Context, taskId: string, revision: number) {
  const task = await getTask(ctx, taskId);
  if (task.revision !== revision) throw new AppError('conflict', { reason: 'revision' });
  eligible(task);
  return admitAi(ctx, 'tasks.breakdown', taskId, revision, {
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    assignablePeople: (await peopleForAi(ctx))
      .filter((person) => person.isAssignable)
      .map((person) => person.name),
  });
}
export async function applyBreakdown(
  ctx: Context,
  taskId: string,
  input: z.infer<typeof BreakdownApply>,
) {
  await lockTasks(ctx.db);
  const { payload, result } = await reviewJob(ctx, input.jobId, taskId, 'tasks.breakdown');
  if (result.appliedIds) return { ids: result.appliedIds };
  const task = await getTask(ctx, taskId);
  if (task.revision !== payload.revision) throw new AppError('conflict', { reason: 'revision' });
  eligible(task);
  const output = BreakdownOutput.parse(result.output);
  const ids: string[] = [];
  for (const index of input.indexes) {
    const suggestion = output.subtasks[index];
    if (!suggestion) throw new AppError('validation_failed');
    const created = await createTask(ctx, TaskCreate.parse({ ...suggestion, parentId: taskId }));
    ids.push(created.id);
  }
  await patchTask(ctx, taskId, { revision: task.revision });
  await applied(ctx, input.jobId, result, ids);
  return { ids };
}
