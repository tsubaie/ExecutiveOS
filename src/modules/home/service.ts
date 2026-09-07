/** HOME-B02–B05: aggregate installed modules and collapse unavailable sections. */
import 'server-only';
import { z } from 'zod';
import type { Context } from '@/core/auth/session';
import { settingValue } from '@/core/db/settings-repo';
import { getPerson, countPeople } from '@/modules/people';
import { homeSummary as tasksSummary } from '@/modules/tasks';
import { Home } from './schema/validation';
export async function homeSummary(ctx: Context) {
  const principalId = z
    .uuid()
    .nullable()
    .parse((await settingValue(ctx.db, 'workspace.principal_person_id')) ?? null);
  const principal = principalId ? await getPerson(ctx, principalId) : null;
  const peopleCount = await countPeople(ctx);
  const tasks = await tasksSummary(ctx);
  return Home.parse({
    name: ctx.user.name,
    principal: principal?.fullName ?? null,
    peopleCount,
    sections: Home.shape.sections.element.shape.key.options.map(
      (key) =>
        tasks.find((section) => section.key === key) ?? {
          key,
          enabled: false,
          count: 0,
        },
    ),
  });
}
