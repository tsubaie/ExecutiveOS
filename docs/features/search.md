# Feature: Search (workspace-wide)

**Status:** accepted
**Spec reviewed:** 2026-09-16
**Implementation verified:** 2026-09-16 for B01, B03, B04 (unit), B08, B11, B12 (browser); B02, B05–B07, B09, B10 and A01–A04 remain open
**Owner module:** `src/core/search`

## Purpose

One question asked of every module at once, for the reader who remembers a phrase but not where it
lives. It does not replace a list's own search: that one filters the list in place and is the right
tool once the reader knows the module. This one answers "where is this" and hands them a record.

## Concepts and vocabulary

- **Provider** — a module's implementation of the search capability, over its own tables. Declared
  on `ServerManifest` and collected by `core/modules/registry.ts` (ADR 0021).
- **Hit** — one record a provider matched: `{ module, id, title, subtitle, href, kind }`. `title`
  is what the record is called, `subtitle` the one line that disambiguates two records with similar
  names (a task's committee, a person's organisation).
- **Corpus** — the `search_text` generated column each searchable table already carries. The
  covered fields are listed under Data model and are part of this spec, not a private detail of
  each repo.

## Data model

No tables and no migration. The corpus is what migration `0001` and each module's own migration
already created:

| Module | Column | Covers |
|---|---|---|
| People | `people.search_text` | full name, display name, organization, role title, email |
| Tasks | `tasks.search_text` | title, description |
| Notes | `notes.search_text` | title, content — plus tags and participant names by join (NOTES-B04) |
| Committees | `committees.search_text` | name, description, ownership |
| KPIs | `kpis.search_text` | name, category, notes |

Every one is `GENERATED ALWAYS AS (eos_normalize(...)) STORED` with a GIN `gin_trgm_ops` index.
`eos_normalize` lowercases, strips Arabic diacritics and folds `أإآٱى` onto `ا`/`ي`.

- SEARCH-I01 A module that adds a searchable field changes this table in the same PR. The corpus is
  a contract: what a column covers is what global search finds.

## Behaviors

- SEARCH-B01 The query is normalised in the application through `core/search/normalize.ts` — the
  same function the repos already use — and matched as a substring against `search_text`. `%` and
  `_` in reader input are escaped, so a query of `100%` searches for the characters.
- SEARCH-B02 A query shorter than two normalised characters returns nothing and the palette says
  so. A single character matches most of the corpus and is never the question being asked.
- SEARCH-B03 Providers run concurrently. Each returns at most 5 hits; the merged list is at most
  20. Results interleave by module round-robin so no single module fills the palette and every
  module that matched is visible. Within a module, order is the module's own: a prefix match on the
  title before a match anywhere, then the module's default list order.
- SEARCH-B04 A provider that throws is reported as that module being unavailable for this query and
  the remaining results are returned. The palette names the module that failed; it never shows an
  empty result because one module is broken.
- SEARCH-B05 Providers apply the same visibility their lists apply: soft-deleted records and
  anything in trash are excluded. A reader cannot reach through search what they cannot reach
  through the list.
- SEARCH-B06 Counts are of what is shown, never of what exists. The palette says "showing 12"; it
  never says "of 340".
- SEARCH-B07 Opening a hit navigates to the owning module's route with the record open —
  `routes.tasks({ id })` and its siblings — so a hit lands on the same surface the list would have
  opened, with the entity framework's own detail panel (EP-B03 covers the record being outside the
  current view).
- SEARCH-B08 The palette is opened with `⌘K` / `Ctrl+K`, or from the header control. `Esc` closes
  it, `↑/↓` move, `Enter` opens. Opening it does not change the URL; it is a way to get somewhere,
  not a place.
- SEARCH-B09 Typing debounces at 200 ms and a superseded request never overwrites a newer one's
  results.
- SEARCH-B10 Recent hits: the last 5 records opened from the palette are shown when it opens with
  an empty query, stored per user in `localStorage`. They are a convenience, not state anything
  depends on, and they render as normal hits with their subjects re-resolved.
- SEARCH-B11 One field, one launcher. The header control is drawn as a button at its natural width
  — the icon, the word and the key hint — beside the notification bell and the account, and on a
  phone as the icon alone. It is never drawn as a text field: an entity list already carries the
  one field on the page (EP-B41), and a second field one row above it made the reader guess which
  one they meant. `⌘K` / `Ctrl+K` and the control open the same palette.
- SEARCH-B12 Opened over an entity list, the palette's first row offers the typed phrase to that
  list — "Search in Tasks for “budget”" — and choosing it closes the palette and filters the list in
  place with the phrase in its own field and in the URL, as a history entry. The list registers
  itself with the palette while it is on screen and withdraws when it leaves; on any other page the
  row is absent. The reverse hand-off, from a list's empty state into the palette, is EP-B41.

## API

`GET /api/v1/search?q=<string>&limit=<1..20>` → `{ data: { hits: SearchHit[], unavailable: string[] } }`

- Authenticated; no idempotency (read-only).
- Invalidation: none. The palette's query key is `["search", q]` with a 30-second stale time.

## UI

- A control in the shell header showing a search icon, the word, and `⌘K` as a hint. It is a button
  that opens the palette, not an input, and it looks like one (SEARCH-B11): a ghost button at its
  natural width in the header's end cluster, never a bordered field. The palette owns the input, so
  there is one place text is typed; the only state handed over is a phrase an entity list's empty
  state carries in (EP-B41).
- Over an entity list the first row of the palette is the hand-off to that list (SEARCH-B12), drawn
  as a hit with the search icon; the module groups follow it.
- The palette is a dialog from `src/ui/primitives/dialog`, with the input as its heading row and
  hits grouped by module under a module label. Each hit shows title, subtitle and the module's own
  icon from its manifest.
- Empty query → recent hits. No results → the query echoed and the modules searched. A failed
  provider → an inline line naming the module, above the results that did arrive.
- Mobile: the header control collapses to the icon alone; the palette is a sheet.
- The input is `type="search"`, `autocomplete="off"`, `spellCheck={false}`, and `autoFocus` on
  desktop only.

## i18n notes

- Every string through `t()` under `common.search.*`. Module labels come from each manifest's
  existing `nav.key`, so a module is named the same in the palette as in the sidebar.
- Normalisation is script-agnostic; an Arabic query matches an Arabic record with different
  diacritics, and the palette renders mixed-direction hits with `dir="auto"` per `05`.
- `⌘K` renders with a non-breaking space and `translate="no"`.

## Acceptance criteria

- SEARCH-A01 `⌘K`, type three characters present in a note body and a task title, and both appear
  under their module headings; `Enter` on the note opens `/notes?id=…` with the record open. (en, ar)
- SEARCH-A02 An Arabic query written without diacritics finds the record written with them. (ar)
- SEARCH-A03 With one provider forced to throw, the palette shows the other modules' hits and names
  the failed one. (en)
- SEARCH-A04 A trashed task is not reachable from the palette. (en)

## Required scenarios

- `src/core/search/tests/merge.test.ts`: B03 round-robin interleave, the per-module and total caps,
  prefix-before-substring ordering; B04 one provider rejecting.
- `src/core/search/tests/normalize.test.ts`: B01 escaping of `%` and `_`; B02 the minimum length.
- `src/core/modules/tests/registry.test.ts`: the search providers are collected like home sections
  and a module declaring none is skipped.
- Per module, `tests/search.test.ts`: B05 visibility — a soft-deleted record does not match.
- e2e `search.spec.ts`: A01, A02, A04 in both locales; B11 the launcher's two forms and that both
  it and the chord open the palette; B12 the hand-off row filters the list on screen.
- `src/ui/layout/tests/search-palette-store.test.ts`: B12 a list registers and withdraws its scope;
  EP-B41 the palette opens carrying the phrase a list handed it.
- Mutation targets: `mergeHits`, `normalizeQuery`, `collectSearchProviders`.

## Audit items

- `src/core/search` has zero imports from `src/modules`; providers reach it through the registry.
- Every module in `serverModules` that owns a searchable table declares a provider.
- The corpus table above matches the `search_text` definitions in the module schemas (checked by
  `audit:docs`).

## Out of scope

- Ranking across modules by a single score (ADR 0021; principle 3 forbids opaque scoring).
- Stemming, synonyms, spelling correction.
- Searching file contents or AI invocation text.
- Saved searches; a search is not a place (SEARCH-B08).
