import { z } from 'zod';
export const Scope = z.enum(['internal', 'external']);
export const Status = z.enum(['active', 'archived']);
export const View = z.enum(['all', 'active', 'archived', 'trash', 'overdue', 'today', 'open', 'completed']);
export const Sort = z.enum(['default', 'name', 'status', 'open_tasks', 'manual']);
export const CommitteeCreate = z.strictObject({
  name: z.string().trim().min(1).max(500), description: z.string().max(50000).default(''),
  ownership: z.string().trim().max(500).default(''), scope: Scope.default('internal'), status: Status.default('active'),
});
export type CommitteeCreate = z.infer<typeof CommitteeCreate>;
export const CommitteePatch = z.strictObject({
  name: CommitteeCreate.shape.name.optional(), description: z.string().max(50000).optional(),
  ownership: z.string().trim().max(500).optional(), scope: Scope.optional(), status: Status.optional(),
  revision: z.number().int().positive(),
});
export type CommitteePatch = z.infer<typeof CommitteePatch>;
const timestamp = z.preprocess((v) => v instanceof Date ? v.toISOString() : v, z.iso.datetime({ offset: true }));
export const Stats = z.object({ open: z.number(), completed: z.number(), overdue: z.number(), today: z.number() });
export const Committee = CommitteeCreate.extend({
  id: z.uuid(), revision: z.number().int(), sortOrder: z.number().int(),
  createdAt: timestamp, updatedAt: timestamp, createdBy: z.uuid().nullable(), updatedBy: z.uuid().nullable(),
  deletedAt: timestamp.nullable(), deletedOpId: z.uuid().nullable(), stats: Stats,
  lastNoteDate: z.iso.date().nullable(),
}).strip();
export type Committee = z.infer<typeof Committee>;
export const CommitteeListQuery = z.strictObject({
  view: View.default('active'), q: z.string().max(500).default(''), scope: z.union([Scope, z.literal('')]).default(''),
  sort: Sort.default('default'), limit: z.coerce.number().int().min(1).max(200).default(50), cursor: z.string().max(4000).optional(),
});
export type CommitteeListQuery = z.infer<typeof CommitteeListQuery>;
export const CommitteeList = z.object({ data: z.array(Committee), meta: z.object({
  counts: z.record(z.string(), z.number()), nextCursor: z.string().nullable(), taskStats: Stats,
}) });
export const CommitteeChoices = z.object({ data: z.array(z.object({ id: z.uuid(), name: z.string(), status: Status, deleted: z.boolean() })) });
export const Revision = z.strictObject({ revision: z.number().int().positive() });
export const Reorder = z.strictObject({ items: z.array(z.strictObject({ id: z.uuid(), revision: z.number().int().positive() })).min(1).max(200)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length) });
export const ActivityQuery = z.strictObject({ cursor: z.string().max(4000).optional() });
export const Activity = z.object({ data: z.array(z.object({ id: z.uuid(), action: z.string(), entityType: z.string(), entityId: z.uuid().nullable(), createdAt: timestamp })), meta: z.object({ nextCursor: z.string().nullable() }) });

export const CommitteeReference = z.object({ id: z.uuid(), name: z.string(), status: Status, deleted: z.boolean() });
