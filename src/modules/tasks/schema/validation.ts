import { z } from 'zod';
export const Status = z.enum(['inbox', 'next_action', 'waiting_on', 'someday', 'completed']);
export const OpenStatus = Status.exclude(['completed']);
export const Priority = z.enum(['low', 'medium', 'high', 'urgent']);
export const View = z.enum([
  'all',
  'today',
  'overdue',
  'upcoming',
  'next',
  'waiting',
  'inbox',
  'someday',
  'completed',
  'trash',
]);
export const Sort = z.enum([
  'default',
  'due_date',
  'priority',
  'title',
  'created_at',
  'updated_at',
]);
export const TaskFields = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(50000).nullable().default(null),
  status: OpenStatus.default('inbox'),
  priority: Priority.nullable().default(null),
  dueDate: z.iso.date().nullable().default(null),
  ownerId: z.uuid().nullable().default(null),
});
export const TaskCreate = TaskFields.extend({
  parentId: z.uuid().nullable().default(null),
}).strict();
export type TaskCreate = z.infer<typeof TaskCreate>;
export const TaskPatch = TaskFields.extend({
  description: TaskFields.shape.description.removeDefault(),
  status: Status,
  priority: TaskFields.shape.priority.removeDefault(),
  dueDate: TaskFields.shape.dueDate.removeDefault(),
  ownerId: TaskFields.shape.ownerId.removeDefault(),
})
  .partial()
  .extend({ revision: z.number().int().positive() })
  .strict();
export type TaskPatch = z.infer<typeof TaskPatch>;
const timestamp = z.preprocess((v) => (v instanceof Date ? v.toISOString() : v), z.iso.datetime());
export const Task = TaskFields.extend({
  id: z.uuid(),
  revision: z.number().int(),
  status: Status,
  parentId: z.uuid().nullable(),
  sortOrder: z.number().int(),
  completedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: z.uuid().nullable(),
  updatedBy: z.uuid().nullable(),
  deletedAt: timestamp.nullable(),
  deletedOpId: z.uuid().nullable(),
  band: z.enum(['overdue', 'today', 'week', 'later', 'nodate']).nullable().default(null),
  ownerName: z.string().nullable().default(null),
  subtaskCount: z.number().default(0),
  completedSubtaskCount: z.number().default(0),
});
export type Task = z.infer<typeof Task>;
export const TaskDetail = Task.extend({
  subtasks: z.array(Task).default([]),
  deletedSubtasks: z.array(Task).default([]),
});
export type TaskDetail = z.infer<typeof TaskDetail>;
export const TaskListQuery = z.strictObject({
  view: View.default('all'),
  q: z.string().max(500).default(''),
  ownerId: z.union([z.uuid(), z.literal('')]).default(''),
  priority: z.union([Priority, z.literal('')]).default(''),
  dueFrom: z.union([z.iso.date(), z.literal('')]).default(''),
  dueTo: z.union([z.iso.date(), z.literal('')]).default(''),
  hasSubtasks: z.enum(['', 'true', 'false']).default(''),
  parentId: z.uuid().optional(),
  includeSubtasks: z.enum(['true', 'false']).optional(),
  sort: Sort.default('default'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(4000).optional(),
  withTotal: z.enum(['true', 'false']).optional(),
});
export type TaskListQuery = z.infer<typeof TaskListQuery>;
export const TaskList = z.object({
  data: z.array(TaskDetail),
  meta: z.object({
    counts: z.record(View, z.number()),
    total: z.number().optional(),
    nextCursor: z.string().nullable(),
    today: z.iso.date(),
    timezone: z.string(),
    defaultView: z.enum(['today', 'next']),
  }),
});
export const Revision = z.strictObject({ revision: z.number().int().positive() });
export const Complete = Revision.extend({ force: z.boolean().default(false) });
export const Move = Revision.extend({ parentId: z.uuid() });
const ids = z
  .array(z.uuid())
  .min(2)
  .max(200)
  .refine((v) => new Set(v).size === v.length);
export const Group = z.strictObject({ title: TaskFields.shape.title, childIds: ids });
export const Reorder = z.strictObject({
  parentId: z.uuid().nullable(),
  orderedIds: ids,
  revisions: z.record(z.uuid(), z.number().int().positive()),
});
