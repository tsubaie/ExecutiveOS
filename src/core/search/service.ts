import 'server-only';
import type { Context } from '@/core/auth/session';
import { searchProviders } from '@/core/modules/registry';
import { normalize } from './normalize';
import { mergeHits } from './merge';
import { MIN_QUERY_LENGTH, PER_MODULE_LIMIT, TOTAL_LIMIT, type SearchResult } from './types';
// SEARCH: one question asked of every module at once (ADR 0021). The corpus is the `search_text`
// column each searchable table already carries; this only orchestrates.
export async function searchWorkspace(
  ctx: Context,
  query: string,
  limit = TOTAL_LIMIT,
): Promise<SearchResult> {
  const normalized = normalize(query).trim();
  // SEARCH-B02: below the floor the answer is "nothing", not "most of the workspace".
  if (normalized.length < MIN_QUERY_LENGTH) return { hits: [], unavailable: [] };
  const providers = searchProviders();
  // SEARCH-B04: one module's bad query is not a reason for the palette to show nothing, so the
  // providers settle rather than race to the first rejection and the failures are named instead.
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.search(ctx, normalized, PER_MODULE_LIMIT)),
  );
  const groups = settled.map((result) => (result.status === 'fulfilled' ? result.value : []));
  const unavailable = providers
    .filter((_, index) => settled[index]?.status === 'rejected')
    .map((provider) => provider.id);
  return { hits: mergeHits(groups, limit), unavailable };
}
