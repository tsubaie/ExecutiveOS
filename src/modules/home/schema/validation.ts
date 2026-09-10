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
        'kpis',
        'initiatives',
        'notes',
      ]),
      enabled: z.boolean(),
      count: z.number(),
      href: z.string().nullable().default(null),
      items: z.array(z.object({ id: z.uuid(), title: z.string(), href: z.string() })).default([]),
    }),
  ),
});
