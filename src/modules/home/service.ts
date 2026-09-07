/** HOME-B02–B05: aggregate installed modules and collapse unavailable sections. */
import 'server-only';
import type { Context } from '@/core/auth/session';
import { getSetting } from '@/core/db/settings-repo';
import { homeProviders } from '@/core/modules/registry';
import type { HomeSection } from '@/core/modules/server-manifest';
import { getPerson, countPeople } from '@/modules/people';
import { Home } from './schema/validation';
// The section order is a product decision (docs/features/home.md); providers fill what they own.
const sectionKeys = Home.shape.sections.element.shape.key.options;
export async function homeSummary(ctx: Context) {
  const principalId = await getSetting(ctx.db, 'workspace.principal_person_id');
  const principal = principalId ? await getPerson(ctx, principalId) : null;
  const peopleCount = await countPeople(ctx);
  const provided: HomeSection[] = [];
  for (const provide of homeProviders()) provided.push(...(await provide(ctx)));
  return Home.parse({
    name: ctx.user.name,
    principal: principal?.fullName ?? null,
    peopleCount,
    sections: sectionKeys.map(
      (key) =>
        provided.find((section) => section.key === key) ?? {
          key,
          enabled: false,
          count: 0,
          href: null,
        },
    ),
  });
}
