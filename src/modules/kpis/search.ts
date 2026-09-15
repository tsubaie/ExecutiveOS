import 'server-only';
import type { Context } from '@/core/auth/session';
import { routes } from '@/core/routes';
import * as repo from './repo';
// ADR 0021: the module answers the workspace-wide query over its own tables and its own
// visibility. SEARCH-B07: a hit lands on the module's route with the record open, so opening one
// from the palette reaches the same surface the list would have (EP-B03 covers a record that is
// outside the current view). Registered on the manifest; nothing imports this directly.
export async function searchProvider(ctx: Context, query: string, limit: number) {
  const rows = await repo.searchKpis(ctx.db, query, limit);
  return rows.map((row) => ({ ...row, module: 'kpis', href: routes.kpis({ id: row.id }) }));
}
