import { z } from 'zod';
export const DefaultType = z.enum([
  'board_meeting',
  'executive_meeting',
  'sector_meeting',
  'one_on_one',
  'personal',
  'other',
]);
export const defaultTypes = DefaultType.options;
export const Sort = z.enum(['default', 'title', 'created_at']);
export const Band = z.enum(['upcoming', 'today', 'week', 'month', 'earlier']);
const dedupe = (values: string[]) =>
  values.filter(
    (value, index) =>
      values.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index,
  );
export const Tag = z.string().trim().min(1).max(50);
// NOTES-I03: at most ten tags, deduplicated case-insensitively with the first spelling kept.
export const Tags = z.array(Tag).max(10).transform(dedupe);
const Ids = z
  .array(z.uuid())
  .max(50)
  .transform((values) => [...new Set(values)]);
const Title = z.string().trim().min(1).max(500);
const Content = z.string().max(50000);
const Type = z.string().trim().min(1).max(100);
const revision = z.number().int().positive();
export const NoteCreate = z.strictObject({
  title: Title,
  content: Content.default(''),
  type: Type.nullable().default(null),
  noteDate: z.iso.date().nullable().default(null),
  tags: Tags.default([]),
  participantIds: Ids.default([]),
});
export type NoteCreate = z.infer<typeof NoteCreate>;
export const NotePatch = z.strictObject({
  title: Title.optional(),
  content: Content.optional(),
  type: Type.optional(),
  noteDate: z.iso.date().optional(),
  tags: Tags.optional(),
  participantIds: Ids.optional(),
  revision,
});
export type NotePatch = z.infer<typeof NotePatch>;
const timestamp = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.iso.datetime({ offset: true }),
);
export const Participant = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.enum(['internal', 'external']),
});
export type Participant = z.infer<typeof Participant>;
export const NoteTask = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  title: z.string(),
  status: z.string(),
  priority: z.string().nullable(),
  dueDate: z.iso.date().nullable(),
  completedAt: timestamp.nullable(),
  ownerName: z.string().nullable(),
});
export type NoteTask = z.infer<typeof NoteTask>;
export const Note = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  title: Title,
  content: Content,
  type: Type,
  noteDate: z.iso.date(),
  tags: z.array(z.string()),
  archivedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: z.uuid().nullable(),
  updatedBy: z.uuid().nullable(),
  deletedAt: timestamp.nullable(),
  deletedOpId: z.uuid().nullable(),
  participants: z.array(Participant).default([]),
  openTaskCount: z.number().default(0),
  doneTaskCount: z.number().default(0),
  band: Band.nullable().default(null),
});
export type Note = z.infer<typeof Note>;
export const NoteDetail = Note.extend({ tasks: z.array(NoteTask).default([]) });
export type NoteDetail = z.infer<typeof NoteDetail>;
export const NoteType = z.object({
  id: z.string(),
  labels: z.record(z.string(), z.string()).nullable(),
  enabled: z.boolean(),
});
export type NoteType = z.infer<typeof NoteType>;
export const NoteListQuery = z.strictObject({
  view: z.string().max(120).default('all'),
  q: z.string().max(500).default(''),
  type: z.union([Type, z.literal('')]).default(''),
  tag: z.union([Tag, z.literal('')]).default(''),
  personId: z.union([z.uuid(), z.literal('')]).default(''),
  from: z.union([z.iso.date(), z.literal('')]).default(''),
  to: z.union([z.iso.date(), z.literal('')]).default(''),
  sort: Sort.default('default'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(4000).optional(),
});
export type NoteListQuery = z.infer<typeof NoteListQuery>;
export const Counts = z.record(z.string(), z.number());
export const NoteList = z.object({
  data: z.array(Note),
  meta: z.object({
    counts: Counts,
    total: z.number(),
    nextCursor: z.string().nullable(),
    today: z.iso.date(),
    timezone: z.string(),
    types: z.array(NoteType),
  }),
});
export const Revision = z.strictObject({ revision });
const items = z
  .array(z.strictObject({ id: z.uuid(), revision }))
  .min(1)
  .max(200)
  .refine((v) => new Set(v.map((item) => item.id)).size === v.length, 'duplicate ids');
export const BulkItems = z.strictObject({ items });
export type BulkItems = z.infer<typeof BulkItems>;
export const BulkTag = z.strictObject({ items, tag: Tag });
export type BulkTag = z.infer<typeof BulkTag>;
export const BulkResult = z.object({ data: z.object({ updatedIds: z.array(z.uuid()) }) });
export const TagList = z.object({
  data: z.array(z.object({ tag: z.string(), count: z.number() })),
});
