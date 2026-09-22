import 'server-only';
import type { Context } from '@/core/auth/session';
import { getSetting } from '@/core/db/settings-repo';
import { compareTuples } from '@/core/db/keyset';
import { routes } from '@/core/routes';
import type { HomeSection } from '@/core/modules/server-manifest';
import { attentionStatuses, KpiListQuery } from './schema/validation';
import { keyOf, toKpi, type Scope } from './service';
import * as repo from './repo';
// HOME-B01 § Attention KPIs: the page consumes this through the module's server manifest.
export async function homeSummary(ctx: Context, day: string): Promise<HomeSection[]> {
  const at: Scope = { today: day, thresholds: await getSetting(ctx.db, 'kpis.status_thresholds') };
  const span = { today: day, fromYear: Number(day.slice(0, 4)) - 1 };
  const rows = await repo.selectKpis(ctx.db, KpiListQuery.parse({ view: 'attention' }), span);
  const attention = rows
    .map((row) => toKpi(row, at))
    .filter((item) => !item.deletedAt && attentionStatuses.includes(item.meta.status))
    .sort((left, right) => compareTuples(keyOf(left, 'default'), keyOf(right, 'default')));
  return [
    {
      key: 'kpis',
      enabled: true,
      count: attention.length,
      href: routes.kpis({ view: 'attention' }),
      stale: attention.filter((item) => item.meta.status === 'stale').length,
      items: attention.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.name,
        href: routes.kpis({ view: 'all', id: item.id }),
        committee: item.objectiveName,
        date: item.meta.currentDate,
        status: item.meta.status,
        ratio: item.meta.achievement,
      })),
    },
  ];
}
