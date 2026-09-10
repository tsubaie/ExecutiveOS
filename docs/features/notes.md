# Feature: Notes

**Status:** accepted
**Spec reviewed:** 2026-09-10
**Implementation verified:** not yet
**Owner module:** `src/modules/notes`

## Purpose

Capture meeting and personal notes fast, record who was involved, turn what was agreed into real tasks, and later turn rough notes into structured notes with AI help. Every note stands alone: there is no grouping of notes into threads (ADR 0012).

## Vocabulary

Note (title, markdown content, type, date, tags, participants, tasks), Type (configurable identifiers; defaults `board_meeting`, `executive_meeting`, `sector_meeting`, `one_on_one`, `personal`, `other`), Participant (a person mentioned in the note's content, stored in `note_people`, ADR 0014), Mention (`@Name` in the content), Linked task (a task whose `source_note_id` is the note), Refinement (AI proposal awaiting review; Phase 3b).

## Data model

See `03-data-model.md` § notes, note_people, note_refinements. Invariants:

- NOTES-I01 `title` is 1–500 characters after trimming and `content` ≤ 50 000 (Zod; CHECK on title).
- NOTES-I02 `type` is null or an identifier from `notes.types`; when that setting is empty the six defaults apply. A disabled type stays valid on existing notes and is refused on create and on change (422 `NOTES-I02`).
- NOTES-I03 Tags ≤ 10, each ≤ 50 characters, deduplicated case-insensitively with the first spelling kept (Zod; CHECK on cardinality).
- NOTES-I04 A person appears at most once among a note's participants (partial unique index on `note_people (note_id, person_id) where deleted_at is null`). Removing a participant soft-deletes the row; adding again inserts a new row. Participants whose person is deleted are hidden until the person is restored.
- NOTES-I05 A task references at most one note (`tasks.source_note_id`). Attaching an existing task requires it to be open, top-level and unlinked (`TASKS-B16`).
- NOTES-I06 Trashing a note keeps `source_note_id` on its tasks; restore brings the relationship back untouched; purge nulls it (`TASKS-I06`). Trashing a note never trashes tasks.
- NOTES-I07 Archive and delete are independent: an archived note can be trashed and is restored still archived.

## Behaviors

- NOTES-B01 **Create**: `title` required; `type` defaults to `notes.default_type` when that names an enabled type, otherwise stays empty; `noteDate` defaults to today in `ctx.timezone`; optional `content`, `tags`, `participantIds`. Committee and initiative references arrive with those modules; no meeting identifier is accepted (ADR 0012).
- NOTES-B02 **Views**: `all` (default; not archived, not deleted), `this_week` (`note_date` between today − 6 days and today), `type:<id>` for each enabled type (a note without a type appears only under `all` and `this_week`), `archived`, `trash`. Counts per view are computed under the same facets and search as the list. In every view except `trash`, archived notes are excluded unless `q` is non-empty, in which case they are included and flagged `archivedAt`.
- NOTES-B03 **Facets**: `type`, `tag`, `personId` (participant), `from` / `to` on `note_date`. AND semantics.
- NOTES-B04 **Search** `q` over title and content through `search_text`, and over tags and participant names by normalized match; Arabic normalization applies to all.
- NOTES-B05 **Sort**: `note_date desc, created_at desc, id desc` (default), `title`, `created_at`; each with `id` tiebreak; keyset cursors.
- NOTES-B06 **Bands** for grouping, computed by one function `bandOf(noteDate, today)`: `upcoming` (`note_date > today`), `today`, `week` (within the previous six days), `month` (within the previous thirty days), `earlier`. No grouping in `trash`.
- NOTES-B07 **Detail** returns the note with `participants[]` (id, name, kind) and `tasks[]` (open first by due date then title, then completed by `completed_at` desc; each with id, title, status, priority, due date, owner name). PATCH carries `revision` and may change title, content, type, date, tags and `participantIds` (replaces the set). The content commits when the editor is left; the same patch carries the participants derived from its mentions (B08).
- NOTES-B08 **Participants are the people mentioned in the content.** Typing `@` anywhere in the content opens a list of people filtered by the text after it; arrows move through the whole list and wrap, Enter or Tab inserts `@Name` at the caret, Escape closes, and the list stays closed for a name just picked until a new `@` is typed. An unknown name offers "Add <name>", which creates an external, non-assignable person through `POST /people` and inserts the mention. When the content is committed, `participantIds` is recomputed as the people (from the workspace directory plus the note's current participants) whose `@Name` appears in the content, so removing a mention removes the participant. There is no separate participants editor; mentions are plain text in the stored markdown.
- NOTES-B09 **Tasks panel**: "+ Task" creates a task with `sourceNoteId` set from a title-only inline row (`POST /tasks`). "Attach task" lists open top-level unlinked tasks (`GET /tasks?view=all&hasSourceNote=false&hasSubtasks=false`) and sets `sourceNoteId` by PATCH. Detach patches `sourceNoteId` to null. The complete toggle calls `POST /tasks/:id/complete`. Row counts `openTaskCount` and `doneTaskCount` come from the same statement as the list.
- NOTES-B10 **Archive** `POST /notes/:id/archive { revision }` sets `archived_at`; `unarchive` clears it. Archived notes keep every relationship.
- NOTES-B11 **Trash** soft-deletes with an op id; `restore { opId }` restores exactly that row; purge after `retention.trash_days`.
- NOTES-B12 **Bulk** `POST /notes/bulk/archive { items: [{ id, revision }] }` and `POST /notes/bulk/tag { items, tag }`, each one transaction: any stale revision → 409 `conflict reason: "revision"` naming the id and nothing changes; a note that would exceed ten tags → 422 `NOTES-I03` naming it and nothing changes; an already archived note or a note that already has the tag is left as is. Idempotent by key.
- NOTES-B13 **Tags** `GET /notes/tags` returns distinct tags over non-deleted notes with counts, sorted by count then name; used for the facet and the editor's autocomplete.
- NOTES-B14 **Home**: `homeSummary` contributes one section "Recent notes": non-archived notes with `note_date` within the last seven days, count and up to five items newest first, `href` to `notes?view=this_week`.
- NOTES-B15 **Person page**: the person detail shows a Notes section with the latest five notes where the person is a participant and a link to `notes?personId=<id>`; the notes module exposes `listNotes` for it.
- NOTES-B16 **Invalidation**: any note mutation invalidates `notes.list*`, `notes.counts`, `notes.detail(id)`, `notes.tags`, `home`, and the details of the people whose participation changed; task mutations invalidate `notes` (counts and panels).
- NOTES-B20 **Types are administered**: the note types (identifier, label per locale, enabled) and the default type are edited on the Administration → Note types page, which writes `notes.types` and `notes.default_type` (`ADMIN-B08`). Disabling a type keeps it on existing notes (I02); `GET /notes/types` returns the enabled types with labels and the resolved default.
- NOTES-B17 **AI**: Refine and Suggest tags are absent from the UI and their routes return 503 `ai_unavailable` until the capabilities exist (Phase 3b). The contract below is binding for that work.

## API

| Verb | Path |
|---|---|
| GET | `/notes` (`view, q, type, tag, personId, from, to, sort, limit, cursor`) |
| POST | `/notes` (`NoteCreate`; 201; idempotent) |
| GET/PATCH/DELETE | `/notes/:id` (`includeDeleted`; PATCH `NotePatch` + `revision`) |
| POST | `/notes/:id/restore` `archive` `unarchive` |
| POST | `/notes/bulk/archive` `/notes/bulk/tag` |
| GET | `/notes/tags` ; GET `/notes/types` (enabled types with labels and the default) |
| POST | `/notes/:id/refine` `suggest-tags` (503 until Phase 3b) |

## UI

List on the entity framework. Row: title (`unicode-bidi: plaintext`), date label (relative within six days, otherwise the date), type chip when the note has a type, open/done task count, tags trailing on wide lists and hidden on a phone; an archived note in search results carries an "Archived" chip. Participants render beside the row through `renderers.rowTrail` as initials avatars (`PersonAvatar`, up to three then "+n"), so pressing one reveals the full name exactly as the owner avatar does on Tasks (`PEOPLE-B09`, `EP-B20`) instead of opening the note. Rail: All, This week, one entry per enabled type, then Archived and Trash under a divider. Grouped by band (B06). Facets: type, tag, person. Bulk bar: Archive (confirm) and Add tag (dialog with autocomplete).

Detail: the title is the editable heading (labelled "Note title"), then type and date as label/value rows, participants as a read-only row of avatar chips that link to the person's page (like the owner link on a task), tags as chips with an autocomplete input (overflow beyond ten is blocked with a count), content shown as the rendered markdown (`src/ui/markdown`, ADR 0015) that turns into a textarea when entered and back into the preview when left, with `@` mentions, the tasks panel (B09) with completed tasks collapsed under a count, footer with relative "Updated", Archive and Move to trash. Autosave through the framework save queue; `revision` conflicts keep the draft.

Create: title, type ("No type" unless `notes.default_type` is set), date (today). Mobile: the panel bar reads Back · save state; tags below the title.

## AI

Phase 3b. `notes.refine` (default model, dedup `notes.refine:<noteId>`) takes the note content, tags, type, locale and the names of assignable people and returns:

```ts
{
  refined_content: string,
  suggested_tasks: { title, description?, status: "inbox"|"next_action"|"waiting_on", priority?, due_date?, owner_name?, source_snippet? }[] (≤ 15),
  suggested_tags: string[] (≤ 5),
  summary_of_changes: string
}
```

A `pending` refinement is stored per note (at most one), becomes `stale` when the note's `revision` moves, and is applied atomically: content replaced if accepted, tags merged, selected tasks created with `source_note_id`. `notes.suggest_tags` (fast model) returns `{ tags: string[] (≤ 5) }` preferring existing workspace tags. Post-parse rules: `owner_name` must match an assignable person or is nulled; `due_date` must parse; tags normalized. Fixtures `notes.refine.v1.{en,ar,mixed,adversarial}.json`.

## i18n notes

Type labels come from `notes.types` per locale; the six defaults have catalog entries. Band labels, "Archived", "Add <name>" and the tasks panel strings live in the `notes` namespace. Dates render in the user's calendar and numerals preferences.

## Acceptance criteria

- NOTES-A01 Creating a note with a title, type and date shows it under Today in All; opening it shows the fields empty of participants and tasks. (en, ar)
- NOTES-A02 Mentioning a known person in the content adds them as a participant; "Add <name>" for an unknown name creates the person and adds them; both appear beside the row and the created person's page lists the note. (en)
- NOTES-A03 "+ Task" with a title creates a linked task in the panel; completing it from the panel moves it under Completed and the row count reads one done. (en, ar)
- NOTES-A04 "Attach task" offers an open unlinked task and not one already linked to another note; attaching shows it in the panel and on the task as a source note chip. (en)
- NOTES-A05 Archiving hides the note from All and shows it under Archived; searching its title from All finds it with an Archived chip. (en)
- NOTES-A06 Selecting three notes with `x` and running Archive from the bulk bar archives all three; selecting two and running Add tag applies the tag to both. (en)
- NOTES-A07 Trashing a note that has tasks keeps the tasks; restoring shows them in the panel again. (en)
- NOTES-A08 Search finds a note by normalized Arabic content, by a tag, and by a participant's name. (ar)
- NOTES-A09 Preview renders headings and lists, strips a script tag and a remote image, and lays Arabic content out right-to-left. (ar)
- NOTES-A10 With AI disabled, Refine and Suggest tags are absent and their routes return 503. (en)
- NOTES-A11 Home shows Recent notes with the note created today; with no recent notes the section collapses. (en)
- NOTES-A12 An administrator adds a note type with English and Arabic labels and sets it as the default; the new type appears in the rail and the create form. (en)

## Required scenarios

- schema: I01, I03, bulk payload shapes.
- service: I02 (disabled type on create and change), I04 (duplicate participant, deleted person hidden), I06, I07; B01 defaults; B07 participant replacement; B12 four cases (plain, stale revision, tag overflow, already archived or tagged).
- constraints: title CHECK, tags cardinality CHECK, participant uniqueness, `tasks.source_note_id` set null on purge.
- repo: each view equals its count under facets; archived-in-search rule; participant name search; sort tuples; cursor continuation; one statement for the list with counts.
- api: all endpoints per `08` item 4; bulk 409 and 422 leave nothing changed; refine and suggest-tags 503.
- ui: row, bands, detail edits, mention menu (filter, arrows, insert, dismissal, quick-create), derived participants, tag overflow block, tasks panel create/attach/detach/complete, editor enter and leave, note types editor.
- e2e `notes.spec.ts`: A01–A12 in the listed locales.
- Mutation targets: `bandOf`, `bulkArchive`, `attachTask` (in tasks: `TASKS-B16` rule).

## Audit items

- The list with its counts is one SQL statement (query counter).
- Note content renders only through `src/ui/markdown`.
- `bandOf` has one definition used by grouping and the UI.

## Out of scope

Threads and merging (ADR 0012); a structural note-to-meeting relationship in v1 (ADR 0012); committee and initiative references; `linkedTo` facets (links core); attachments; pinning; private notes; AI refine and suggest tags (Phase 3b).
