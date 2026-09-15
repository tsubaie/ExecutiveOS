import 'server-only';
import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { likePattern, prefixPattern } from '@/core/search/merge';
// ADR 0021: the corpus is the generated `search_text` column each searchable table already
// carries. These two build the predicate and the rank against it so that five repos express the
// same match the same way; the queries themselves stay in each module's repo, which is where the
// module's own visibility lives.
export function searchMatch(corpus: SQLWrapper, normalized: string): SQL {
  return sql`${corpus} like ${likePattern(normalized)}`;
}
// SEARCH-B03: 0 when the record's name starts with what was typed, 1 for a match anywhere. The
// name is normalised here rather than read from the corpus, because the corpus concatenates every
// searchable field and a prefix of it is not a prefix of the title.
export function searchRank(name: SQLWrapper, normalized: string): SQL<0 | 1> {
  return sql<0 | 1>`case when eos_normalize(${name}) like ${prefixPattern(normalized)} then 0 else 1 end`;
}
