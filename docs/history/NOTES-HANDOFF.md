# Hand-off: WI-0002 — Notes core

Status: complete

## Summary

Notes ship as standalone entities on the entity framework: title, markdown content with a sanitized preview, type, date, tags, participants, and linked tasks. The thread model in the original spec was replaced after the maintainer's planning review on 2026-09-10 (ADR 0012 on main records the no-threading decision; ADR 0014 records participants and linked tasks); the markdown renderer decision is ADR 0015. Bulk archive and bulk tag replace merge as the framework's multiselect validation. Tasks gained the `source_note_id` column with the `TASKS-B16` attach rule and source-note facets, the person page gained a Notes section, and Home gained a Recent notes section. Refine and Suggest tags stay absent and their routes answer 503 until the AI foundation (Phase 3b).

## Follow-up after the maintainer's first test (2026-09-10)

Three product changes requested on the running branch and shipped in the same PR:

1. **Type is optional** and empty by default: `notes.type` is nullable (`drizzle/0005_notes-optional-type.sql`), "No type" leads the type picker, the row shows no type chip, and `notes.default_type` applies only when it names an enabled type (NOTES-I02, B01 updated).
2. **One editor surface**: the content shows the rendered markdown; entering it (click, Enter or Space on the preview button) opens the textarea, leaving it commits and shows the preview again; empty content stays a textarea. The Write / Preview switch is gone. Links inside the editable preview render as text because a control cannot contain another control; the standalone renderer keeps links. The editor half loads lazily so the Tasks route stays under the bundle budget (notes.md § UI, NOTES-B07).
3. **`@` mentions**: typing `@` in the content lists people filtered by the text after it; arrows move and wrap, Enter or Tab inserts `@Name` at the caret, Escape closes; the picked person is added to the participants (NOTES-B08). After the maintainer's second test, two bugs were fixed: the highlight reset on every key-up, and a picked name (which contains a space) kept reopening the menu; the menu now stays closed for the picked token and treats a multi-word query that matches nobody as prose. Covered by `tests/ui/markdown.test.tsx` and the NOTES-A02 scenario.

After the maintainer's third test, three more changes, plus a rebase:

4. **Participants come from mentions only.** The participants editor and picker are gone; `@` mentions (with "Add <name>" for an unknown name, which creates the person) are the way to involve people, and the participants saved with the content are the people whose `@Name` appears in it, so removing a mention removes the participant. The detail shows participants as chips linking to their pages, like the owner link on a task (NOTES-B07, B08).
5. **Row avatars behave like Tasks.** Participants render beside the row through the framework's `renderers.rowTrail` with `PersonAvatar`, so pressing one reveals the name instead of opening the note (EP-B20, PEOPLE-B09), reusing what main added for task owners.
6. **Note types are administered** on the new Administration → Note types page (`/admin/notes`): identifiers, English and Arabic labels, enabled, and the default, written to `notes.types` and `notes.default_type` (ADMIN-B08, NOTES-B20, NOTES-A12). `GET /notes/types` now returns catalog labels for the six defaults so the page and the rail share one source.
7. **Rebased onto `origin/main` (6d548ba).** Main had meanwhile accepted its own ADR 0012 (notes are never threaded) and ADR 0013 (trusted client addresses) and rewritten the notes-related docs; per the maintainer, our notes spec is the final one and was kept, with only the ADR numbers reconciled: our decisions are now ADR 0014 (participants and linked tasks) and ADR 0015 (markdown rendering), and the spec cites main's 0012 for the no-threading rule. Conflicts in `TaskRow`, `TaskTextFields` (the render-prop `Field`), the create form and the data-model doc were resolved by hand. Two small fixes rode along: the duplicate sort-option block on the Tasks and Notes pages became `src/ui/entity/filters.ts`, and the audit log's scrollable diff block gained `tabIndex` for the axe `scrollable-region-focusable` rule. Running the auth suite locally needs `RECOVERY_TOKEN` in `.env.test` as in `.env.test.example`.

8. **Click-to-caret.** After the maintainer's fourth test: clicking the rendered preview opens the editor with the caret at the clicked text. The text node under the pointer is looked up in the markdown source (`src/ui/markdown/caret.ts`, nth rendered occurrence → nth source occurrence); a click that resolves nowhere, or keyboard entry, lands at the end. A race found by the mobile scenario was fixed alongside: a commit now waits for an in-flight "Add name" creation before deriving the participants.

9. **Focus on the open record.** The framework's softening now covers the list as well as the sidebar and rail while a panel is open (EP-B07), so Notes and Tasks both dim everything but the open record; hover or focus still restores an element.

10. **Legacy import.** `scripts/db/import-mission-control-notes.ts <database.sql>` imports the `notion_notes` rows of a Mission Control plain-SQL dump as standalone notes through the notes service (title, content, date in the workspace timezone, tags, archived state; a missing title falls back to the legacy thread title). Legacy types outside the six defaults are registered as enabled note types (the maintainer's dump added `he_meeting`, editable on Administration → Note types). A note whose title and date already exist is skipped, so the script re-runs safely. Run on the maintainer's preview database on 2026-09-10: 32 imported, 3 skipped as duplicates within the dump, 5 archived. The dump itself stays outside the repository (`tmp/`).

ADR 0015 still describes the original "textarea with a preview toggle" in its context paragraph; the accepted decision (the renderer and sanitizer) is unchanged and the spec now governs the editor behavior.

## Requirement → scenario

| ID | Test file | Scenario name |
|---|---|---|
| NOTES-I01, I03 | `src/modules/notes/tests/schema.test.ts`, `constraints.test.ts` | title and content bounds; tags cap and dedupe; database CHECKs |
| NOTES-I02 | `src/modules/notes/tests/service.test.ts` | refuses a disabled type on create and on change while existing notes keep it |
| NOTES-I04, B07, B08 | `service.test.ts`, `constraints.test.ts` | participants deduplicate, replace as a set, hide deleted people; unique active row |
| NOTES-I05, B09, TASKS-B16 | `service.test.ts`, `src/modules/tasks/tests/service.test.ts` | attaches only open, top-level, unlinked tasks and detaches by null; source note facets |
| NOTES-I06, I07, B10, B11, A07 | `service.test.ts`, `constraints.test.ts` | trash keeps task links, restore keeps the archive state, purge nulls the link |
| NOTES-B01, A01 | `service.test.ts`, `e2e/notes.spec.ts` | defaults; create through the UI in en and ar |
| NOTES-B02, B03, B05 | `service.test.ts`, `repo.test.ts` | views equal counts under facets; archived-in-search; cursors; one statement |
| NOTES-B04, A08 | `service.test.ts`, `e2e/notes.spec.ts` | Arabic normalization, tag and participant name search |
| NOTES-B06 | `schema.test.ts` | bands by distance from today |
| NOTES-B12, A06 | `service.test.ts`, `e2e/notes.spec.ts` | bulk archive and tag are all-or-nothing; bulk bar flow |
| NOTES-B13 | `service.test.ts` | distinct tags with counts |
| NOTES-B14, A11, HOME-B01 | `service.test.ts`, `e2e/notes.spec.ts` | recent notes section, collapse when empty |
| NOTES-B15, A02 | `e2e/notes.spec.ts` | mention adds a participant, "Add name" creates one, person page Notes section |
| NOTES-B20, A12, ADMIN-B08 | `e2e/notes.spec.ts` | administrator adds a note type and makes it the default |
| NOTES-A03 | `e2e/notes.spec.ts` | "+ Task" creates a linked task; completing it moves it under Completed |
| NOTES-A04 | `e2e/notes.spec.ts` | attach an existing unlinked task; a linked one is not offered |
| NOTES-A05 | `e2e/notes.spec.ts`, `tests/ui/note-row.test.tsx` | archive hides from All, shows under Archived, found by search with the chip |
| NOTES-A09 | `tests/ui/markdown.test.tsx`, `e2e/notes.spec.ts` | preview renders and sanitizes; Arabic content lays out RTL |
| NOTES-A10, B17 | `e2e/notes.spec.ts` | no Refine or Suggest buttons; refine route answers 503 |
| NOTES-B16 | `src/modules/notes/ui/queries.ts`, `src/modules/tasks/ui/queries.ts` | invalidation keys (reviewed, not scenario-tested) |
| EP-A05 | `e2e/notes.spec.ts` (NOTES-A06) | three notes archived from the bulk bar; two tagged |

## Files changed

- `src/modules/notes`: schema (db, validation), repo, service, api, index, manifest, ui (page, row, detail, fields, tags, tasks panel, add-tag dialog, person section, note types admin page, queries, labels), tests (schema, service, repo, constraints, ui).
- `src/app/(app)/notes`, `src/app/(app)/admin/notes`, `src/app/api/v1/notes/**`: page and route files; `AdminLayout` and `routes.admin` gain the `notes` page; `src/modules/settings/ui` exports its settings hooks.
- `src/ui/markdown`: sanitize schema, `Markdown`, `MarkdownField` with the lazily loaded `MarkdownEditor`, `MentionMenu` and `mentions.ts` helpers (ADR 0013); `.dependency-cruiser.cjs` rule confining the renderer packages.
- `src/modules/tasks`: `source_note_id` column and index, `sourceNote` on rows, `sourceNoteId` and `hasSourceNote` facets, `TASKS-B16` rule, source note chip and link, markdown description field, exported `useTaskMutations` and `useTasks`, `notes` in the invalidation list.
- `src/modules/people/ui/PersonDetail.tsx`: Notes section. `src/modules/home`: `notes` section key.
- `src/core/routes.ts`, `src/core/modules/{registry,client}.ts`, `src/core/time/notes.ts`, `src/core/i18n/messages/{en,ar}.json` (`notes` namespace, `common.notes`, editor mode strings, `tasks.noteTrashed`, `home.notes`).
- `drizzle/0004_notes.sql`, `openapi.json`, `docs/**` (spec rewrite, data model, ADR 0012 and 0013, roadmap, WI-0002, this hand-off, `docs/screenshots/notes-*`), `tools/capture-notes.mjs`, `tests/fixtures/notes/preview.json`, `e2e/notes.spec.ts`.
- `package.json`: `react-markdown 10.1.0`, `remark-gfm 4.0.1`, `rehype-sanitize 6.0.0`.

## Migrations

`drizzle/0004_notes.sql`: `notes` (checks on title and tag cardinality, generated `search_text`, partial date index, gin indexes on tags and search), `note_people` (partial unique index on active rows), `tasks.source_note_id` with set-null FK and index. Applied to the empty `executiveos_test` and the seeded `executiveos_e2e_test` databases; `drizzle/0005_notes-optional-type.sql` drops the not-null constraint on `notes.type`. Applied to the empty `executiveos_test`, the seeded `executiveos_e2e_test` and the maintainer's preview database; the migration-lock scenario now expects six records.

## Audits

`pnpm audit:all` in the tooling container (gate env: `executiveos_e2e_test` for the app, `executiveos_test` for Vitest), 2026-09-10:

```text
lint, typecheck, depcruise: pass (330 modules, 1142 dependencies, no violations)
audit:structure 0 / audit:i18n 0 (23 dynamic-key warnings, pre-existing pattern) / audit:portability 0
audit:docs 0 (coverage warnings only on unimplemented specs) / audit:schema 0 / audit:tests 0 (layer warnings)
audit:deps 0 / audit:secrets 0
vitest: 37 files, 135 tests passed
build: pass (pre-existing instrumentation and backup bundler warnings)
audit:bundle 0 (notes route 245 KB after lazy-loading the participant picker; shared bundle 166 KB warning, pre-existing)
playwright: 52 passed (desktop and mobile; notes 16, tasks, people, admin, home)
audit:openapi 0 / audit:a11y 0 / audit:perf 0 (5 informational samples) / audit:dupes 0
```

Two notes on the run. First, one gate attempt was invalid because a standalone server left over from the screenshot capture was reused by Playwright while the gate rebuilt `.next` under it; every Tasks scenario failed on chunk loads until that process was killed. Second, the People preview scenario failed twice on its own: 72 trashed people had accumulated in the e2e database across runs (the idempotency and preview scenarios trash their records), pushing its row past the first page of Trash. The trashed test rows were hard-deleted from `executiveos_e2e_test` and the suite passed; that scenario stays order-sensitive until trash purging or per-run cleanup exists. The e2e steps and the last four audits were re-run after the purge on the unchanged tree; `openapi.json` was regenerated for `GET /notes/types` in that pass.

## Manual verification

Screenshots under `docs/screenshots/notes-{list,detail,create}-{en,ar}-{desktop,mobile}.png`, captured by `tools/capture-notes.mjs` with an axe pass on each (no serious or critical violations, no horizontal overflow, no page errors). en desktop ✔ / ar desktop ✔ / en 390px ✔ / ar 390px ✔.

## Assumptions

1. `notes.types` empty means the six spec defaults, all enabled, with catalog labels; recorded in NOTES-I02.
2. `note_people` carries an `id` primary key alongside the junction columns so removed rows can be soft-deleted and re-added; recorded in `03-data-model.md`.
3. Tags are searched by normalized element match rather than through `search_text`, because `array_to_string` is not immutable in PostgreSQL; recorded in NOTES-B04.
4. `GET /notes/types` returns the enabled types with labels and the resolved default so the create form and the rail do not need the settings API; recorded in the spec API table.
5. The UI facets are type, tag and person; the API keeps `from` and `to` but the framework has no date-range facet control; recorded in notes.md § UI.
6. A source note chip on the task row shows the title, or "Note in trash" while the note is trashed; recorded in TASKS-B16.

## Open questions

None.

## Out of scope, noticed

- `tasks.breakdown` remains the 503 stub; the AI foundation (`core/ai` provider, fake provider, capabilities, budget) is the prerequisite for both breakdown and notes refine (Phase 3b).
- `ADMIN-B08` notes types editor does not exist; types are configurable only by writing the `notes.types` setting.
- The pre-existing modified `docs/screenshots/tasks-*` files in the working tree were not touched or committed.
- The `[WebServer] Error: The destination stream closed early` line printed by Next.js during e2e runs is unrelated to notes (a response closed by a navigating test).
