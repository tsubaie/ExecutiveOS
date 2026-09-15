import { z } from 'zod';
// ADR 0022. The kinds are a closed set here and a CHECK constraint in the database; the module
// that owns each one declares it on its manifest and the audit checks the three agree.
export const NotificationKind = z.enum([
  'task.assigned',
  'task.due_today',
  'task.overdue',
  'note.mentioned',
  'kpi.off_target',
  'job.finished',
]);
export type NotificationKind = z.infer<typeof NotificationKind>;
export const Notification = z.object({
  id: z.uuid(),
  kind: NotificationKind,
  subjectType: z.string(),
  subjectId: z.uuid(),
  // NOTIF-B06: resolved through the owning module at read time, never stored.
  title: z.string(),
  href: z.string(),
  actorName: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type Notification = z.infer<typeof Notification>;
export const NotificationFeed = z.object({
  data: z.object({
    items: z.array(Notification),
    unread: z.number().int(),
    nextCursor: z.string().nullable(),
  }),
});
export const FeedQuery = z.strictObject({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
