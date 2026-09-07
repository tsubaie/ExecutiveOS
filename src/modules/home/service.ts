/** HOME-B02–B05: aggregate installed modules and collapse unavailable sections. */
import 'server-only';
import type { Context } from '@/core/auth/session';
import { getSetting } from '@/core/db/settings-repo';
import { getPerson, countPeople } from '@/modules/people';
import { homeSummary as tasksSummary } from '@/modules/tasks';
import { Home } from './schema/validation';
export async function homeSummary(ctx: Context) {
  const principalId = await getSetting(ctx.db, 'workspace.principal_person_id');
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
