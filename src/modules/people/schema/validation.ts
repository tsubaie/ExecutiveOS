import { z } from 'zod';
const text = z.string().trim().max(500).nullable();
export const Kind = z.enum(['internal', 'external']);
export const View = z.enum(['all', 'assignable', 'internal', 'external', 'trash']);
export const PersonFields = z.object({
  fullName: z.string().trim().min(1).max(500),
  displayName: text,
  honorific: text,
  organization: text,
  roleTitle: text,
  kind: Kind,
  email: z.union([z.email(), z.literal('')]).nullable(),
  phone: text,
  notes: z.string().max(50000).nullable(),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(10)
    .transform((v) =>
      v.filter((s, i) => v.findIndex((t) => t.toLowerCase() === s.toLowerCase()) === i),
    ),
  isAssignable: z.boolean(),
  userId: z.uuid().nullable(),
});
export const PersonCreate = PersonFields.extend({
  confirmDuplicate: z.boolean().default(false),
}).strict();
export type PersonCreate = z.infer<typeof PersonCreate>;
export const PersonPatch = PersonFields.partial()
  .extend({ revision: z.number().int().positive() })
  .strict();
export type PersonPatch = z.infer<typeof PersonPatch>;
const timestamp = z.preprocess((v) => (v instanceof Date ? v.toISOString() : v), z.iso.datetime());
export const Person = PersonFields.extend({
  id: z.uuid(),
  revision: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: z.uuid().nullable(),
  updatedBy: z.uuid().nullable(),
  deletedAt: timestamp.nullable(),
  deletedOpId: z.uuid().nullable(),
});
export type Person = z.infer<typeof Person>;
export const PersonListQuery = z.strictObject({
  view: View.default('all'),
  q: z.string().max(500).default(''),
  tag: z.string().max(50).default(''),
  organization: z.string().max(500).default(''),
  sort: z.enum(['name']).default('name'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(3000).optional(),
  withTotal: z.enum(['true', 'false']).optional(),
});
export type PersonListQuery = z.infer<typeof PersonListQuery>;
export const PersonList = z.object({
  data: z.array(Person),
  meta: z.object({
    counts: z.record(View, z.number()),
    nextCursor: z.string().nullable(),
    total: z.number(),
  }),
});
export const PersonCreated = z.object({
  data: Person.nullable(),
  meta: z.object({ possibleDuplicates: z.array(Person) }),
});
