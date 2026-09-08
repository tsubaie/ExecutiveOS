/** HOME-B02–B06: aggregate installed modules and collapse unavailable sections. */
import 'server-only';
import type { Context } from '@/core/auth/session';
import { getSetting } from '@/core/db/settings-repo';
import { collectHomeSections } from '@/core/modules/registry';
import { getPerson, countPeople } from '@/modules/people';
import { Home } from './schema/validation';
// The section order is a product decision (docs/features/home.md); providers fill what they own.
const sectionKeys = Home.shape.sections.element.shape.key.options;
export async function homeSummary(ctx: Context) {
  const principalId = await getSetting(ctx.db, 'workspace.principal_person_id');
  const principal = principalId ? await getPerson(ctx, principalId) : null;
  const peopleCount = await countPeople(ctx);
  const provided = await collectHomeSections(ctx, sectionKeys);
  return Home.parse({
    name: ctx.user.name,
    principal: principal?.fullName ?? null,
    peopleCount,
    sections: sectionKeys.map(
      (key) => provided.get(key) ?? { key, enabled: false, count: 0, href: null },
    ),
  });
}
