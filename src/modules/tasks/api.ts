import { z } from 'zod';
import { defineHandler, authenticated } from '@/core/http/handler';
import { AppError } from '@/core/http/errors';
import {
  TaskDetail,
  TaskCreate,
  TaskPatch,
  TaskList,
  TaskListQuery,
  Revision,
  Complete,
  Move,
  Group,
  Reorder,
} from './schema/validation';
import * as service from './service';
const taskId = (params: Record<string, string>) => z.uuid().parse(params.id);
const response = z.object({ data: TaskDetail });
export const list = defineHandler({
  guard: 'session',
  input: TaskListQuery,
  response: TaskList,
  handler: (input, ctx) => service.listTasks(authenticated(ctx), input),
});
export const create = defineHandler({
  guard: 'session',
  input: TaskCreate,
  response,
  status: 201,
  idempotent: true,
  handler: async (input, ctx) => ({ data: await service.createTask(authenticated(ctx), input) }),
});
export const detail = defineHandler({
  guard: 'session',
  input: z.strictObject({ includeDeleted: z.enum(['true', 'false']).optional() }),
  response,
  handler: async (input, ctx, params) => ({
    data: await service.getTask(
      authenticated(ctx),
      taskId(params),
      input.includeDeleted === 'true',
    ),
  }),
});
export const patch = defineHandler({
  guard: 'session',
  input: TaskPatch,
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.patchTask(authenticated(ctx), taskId(params), input),
  }),
});
export const remove = defineHandler({
  guard: 'session',
  input: Revision,
  response: z.object({ opId: z.uuid() }),
  status: 204,
  handler: (input, ctx, params) =>
    service.removeTask(authenticated(ctx), taskId(params), input.revision),
});
export const restore = defineHandler({
  guard: 'session',
  input: z.strictObject({ opId: z.uuid() }),
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.restoreTask(authenticated(ctx), taskId(params), input.opId),
  }),
});
export const complete = defineHandler({
  guard: 'session',
  input: Complete,
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.completeTask(
      authenticated(ctx),
      taskId(params),
      input.revision,
      input.force,
    ),
  }),
});
export const reopen = defineHandler({
  guard: 'session',
  input: Revision,
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.reopenTask(authenticated(ctx), taskId(params), input.revision),
  }),
});
export const convert = defineHandler({
  guard: 'session',
  input: Revision,
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.moveTask(authenticated(ctx), taskId(params), input.revision, null),
  }),
});
export const move = defineHandler({
  guard: 'session',
  input: Move,
  response,
  idempotent: true,
  handler: async (input, ctx, params) => ({
    data: await service.moveTask(
      authenticated(ctx),
      taskId(params),
      input.revision,
      input.parentId,
    ),
  }),
});
export const group = defineHandler({
  guard: 'session',
  input: Group,
  response,
  status: 201,
  idempotent: true,
  handler: async (input, ctx) => ({ data: await service.groupTasks(authenticated(ctx), input) }),
});
export const reorder = defineHandler({
  guard: 'session',
  input: Reorder,
  response,
  idempotent: true,
  handler: async (input, ctx) => ({ data: await service.reorderTasks(authenticated(ctx), input) }),
});
export const breakdown = defineHandler({
  guard: 'session',
  input: Revision,
  response,
  handler: async () => {
    throw new AppError('ai_unavailable');
  },
});
