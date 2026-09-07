import 'server-only';
import { CronExpressionParser } from 'cron-parser';
import { db } from '@/core/db/client';
import { dueSchedules, markOccurrence, enqueue } from '@/core/db/jobs-repo';
import { z } from 'zod';
export async function scheduleDue(now = new Date()) {
  await db().transaction(async (database) => {
    for (const schedule of await dueSchedules(database)) {
      const occurrence = CronExpressionParser.parse(schedule.cron, {
        currentDate: now,
        tz: schedule.timezone,
      })
        .prev()
        .toDate();
      if (schedule.lastOccurrence && occurrence <= schedule.lastOccurrence) continue;
      await enqueue(
        database,
        schedule.kind,
        z.json().parse(schedule.payload),
        `${schedule.kind}:${occurrence.toISOString()}`,
      );
      await markOccurrence(database, schedule.id, occurrence);
    }
  });
}
