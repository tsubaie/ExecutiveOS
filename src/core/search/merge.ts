import { TOTAL_LIMIT, type SearchHit } from './types';
// SEARCH-B03: the merge is round-robin across modules, not a sort by score. The five corpora have
// no comparable notion of relevance and inventing one would be the opaque scoring principle 3
// forbids (ADR 0021), so the only ranking that crosses a module boundary is "everyone gets a turn".
// Within a module the order is the module's own, with a title the query starts before a match
// anywhere -- that comparison is inside one corpus, where it means something.
export function mergeHits(groups: readonly (readonly SearchHit[])[], limit = TOTAL_LIMIT) {
  const queues = groups
    .map((group) => [...group].sort((a, b) => a.rank - b.rank))
    .filter((group) => group.length > 0);
  const merged: SearchHit[] = [];
  for (let round = 0; merged.length < limit; round += 1) {
    const before = merged.length;
    for (const queue of queues) {
      const hit = queue[round];
      if (hit) merged.push(hit);
      if (merged.length === limit) return merged;
    }
    if (merged.length === before) return merged;
  }
  return merged;
}
// The pattern the generated `search_text` columns are matched against. The column stored
// `eos_normalize(...)`, so the query is normalised the same way before it is sent; `%` and `_` are
// reader input here and are escaped, so a query of `100%` searches for those characters
// (SEARCH-B01). The escape character is the SQL default backslash, which must itself be escaped.
export function likePattern(normalized: string) {
  return `%${normalized.replace(/[\\%_]/g, '\\$&')}%`;
}
// The same escaping anchored at the start, for the one comparison that is meaningful inside a
// single corpus: a title the query begins before a match anywhere in the record (SEARCH-B03).
export function prefixPattern(normalized: string) {
  return `${normalized.replace(/[\\%_]/g, '\\$&')}%`;
}
