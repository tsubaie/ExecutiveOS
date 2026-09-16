import { z } from 'zod';
export const Home = z.object({
  name: z.string(),
  principal: z.string().nullable(),
  peopleCount: z.number(),
  sections: z.array(
    z.object({
      key: z.enum([
        'nextMeetings',
        'prep',
        'overdue',
        'today',
        'waiting',
        'committees',
        'kpis',
        'initiatives',
        'notes',
      ]),
      enabled: z.boolean(),
      count: z.number(),
      href: z.string().nullable().default(null),
      stale: z.number().nullable().default(null),
      days: z
        .array(z.object({ date: z.iso.date(), count: z.number(), href: z.string() }))
        .nullable()
        .default(null),
      items: z
        .array(
          z.object({
            // A row is usually a record, but a section may add a row that is not one (the
            // unassigned holder in Waiting on), so the id is a key rather than a record id.
            id: z.string().min(1),
            title: z.string(),
            href: z.string(),
            date: z.iso.date().nullable().default(null),
            owner: z.string().nullable().default(null),
            committee: z.string().nullable().default(null),
            count: z.number().nullable().default(null),
            revision: z.number().nullable().default(null),
            overdue: z.number().nullable().default(null),
            done: z.number().nullable().default(null),
            status: z.string().nullable().default(null),
            ratio: z.number().nullable().default(null),
          }),
        )
        .default([]),
    }),
  ),
});
