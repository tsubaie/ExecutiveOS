# ADR 0021 — Global search fans out over module providers

**Status:** accepted (2026-09-15)

## Context

Every entity list already searches itself. The reader types in the list's own bar and the module's
repo filters on a `search_text` column, and that column is not a per-module invention: migration
`0001` installed `pg_trgm` and `eos_normalize(text)`, which lowercases, strips the Arabic
diacritics `[ً-ٰٟـ]` and folds `أإآٱى` onto `ا` and `ي`. Every searchable table then declares a
`GENERATED ALWAYS ... STORED` column over its own fields and a GIN trigram index on it: `people`
over name, organisation, role and email; `tasks` over title and description; `notes` over title and
content; `committees` over name, description and ownership; `kpis` over name, category and notes.

So the corpus, the normalisation and the indexes for a workspace-wide search already exist and are
already bilingual. What does not exist is a way to ask all of them one question. A reader who
remembers a phrase but not which module it is in has to visit five lists and retype it in each.

The question this ADR settles is where that one question is answered.

## Decision

- **Search fans out over per-module providers and merges in `src/core/search`.** `ServerManifest`
  gains `search?: (ctx, query, limit) => Promise<SearchHit[]>`, exactly as it already carries
  `homeSummary`, and `core/modules/registry.ts` collects the providers the way it collects home
  sections. A module owns the query over its own tables, because a module already owns what its
  records are visible to whom and what counts as a match — notes already widen theirs to tags and
  participant names, and that knowledge does not belong in core.
- **No union view and no shared search index.** A materialised union of every entity's text would
  be a second copy of data that is already indexed, kept in step by triggers on five tables, and it
  would have to re-encode each module's own visibility rules to be safe to query. The generated
  columns are the index; the fan-out is the query planner's problem per module, and each of those
  queries is a trigram index hit against one table.
- **The providers run concurrently and the service merges, ranks and truncates.** A module returns
  at most the per-module limit; the service interleaves so that no single module can fill the
  result list, and the reader always sees every module that matched. Ranking is by match quality
  within a module and then round-robin across modules, never by a cross-module score: the five
  corpora have no comparable notion of relevance and inventing one would be exactly the opaque
  scoring principle 3 forbids.
- **A provider that fails does not fail the search.** Its module is reported as unavailable in that
  result set and the rest are returned. One module's bad query is not a reason for the palette to
  show nothing.
- **The query is normalised in the application through `core/search/normalize.ts`**, the same
  function the repos already use, so the pattern sent to Postgres matches what the generated column
  stored. Nothing calls `eos_normalize` from the application side; it exists for the column.

## Consequences

- No migration. The feature ships against the schema that is already deployed, which is why the
  data layer is not what this decision is about.
- `search_text` becomes a contract rather than a private detail of each repo. A module changing
  what its column covers changes what global search finds, and `features/search.md` records the
  covered fields per module so that a change to one is a documented change.
- `core/modules/registry.ts` remains the single place in `src/core` that imports from
  `src/modules`, which is the existing exception the dependency rules already carve out for the
  home fan-out.
- Bodies are searched, because the columns already include them: a note is found by its content and
  a task by its description. That was true inside each list already; it is now true globally.
- Result counts are approximate by construction. The palette says how many it is showing, never how
  many exist, because counting every match across five tables to render ten rows is work nobody
  asked for.
- Trigram matching is substring matching, so it finds `budget` inside `budgets` and inside
  `rebudgeting`. That is the behaviour the lists already have and readers are used to; it is not
  stemming and it does not rank by term frequency.

## Alternatives considered

- **A `search_documents` table maintained by triggers.** One index, one query, one ranking. It also
  duplicates every searchable field in the database, needs a trigger per table kept correct through
  every future migration, and has to re-implement each module's visibility rules at query time or
  leak records. Rejected: the cost is permanent and the benefit is one fewer query per search.
- **Postgres full-text search (`tsvector`) instead of trigrams.** Better ranking and stemming for
  English, but the Arabic configuration is the default `simple` one, which stems nothing; the
  existing trigram columns treat both scripts identically, which is what principle 4 asks for.
  Changing the matching model is also a change to what every list already does, which is a much
  larger decision than adding one palette.
- **Searching from the client by querying each module's list endpoint.** No new server surface, but
  five round trips per keystroke, five sets of pagination to reconcile, and the merge logic on the
  slowest machine in the system.
- **An external index (Meilisearch, Typesense).** Ruled out by principle 6 and by ADR 0008: it is a
  separately running service.
