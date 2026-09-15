import type { Context } from '@/core/auth/session';
// SEARCH: one record a module matched. `subtitle` is the one line that tells two records with
// similar names apart -- a task's committee, a person's organisation -- and is optional because
// not every module has one to give. `rank` is a module's own ordering signal and is never compared
// across modules (ADR 0021): 0 for a title the query starts, 1 for a match anywhere.
export type SearchHit = {
  module: string;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
  rank: 0 | 1;
};
// A module's implementation of the capability, over its own tables and its own visibility rules.
export type SearchProvider = (ctx: Context, query: string, limit: number) => Promise<SearchHit[]>;
export type SearchResult = { hits: SearchHit[]; unavailable: string[] };
// SEARCH-B03: a module returns at most this many, and the merged list is at most the total, so no
// single module can fill the palette and every module that matched stays visible.
export const PER_MODULE_LIMIT = 5;
export const TOTAL_LIMIT = 20;
// SEARCH-B02: one character matches most of the corpus and is never the question being asked.
export const MIN_QUERY_LENGTH = 2;
