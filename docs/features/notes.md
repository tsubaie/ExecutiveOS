# Feature: Notes

**Status:** accepted
**Spec reviewed:** 2026-09-10
**Implementation verified:** not yet
**Owner module:** `src/modules/notes`

## Purpose

Capture meeting and personal notes fast, record who was involved, turn what was agreed into real tasks, and later turn rough notes into structured notes with AI help. Every note stands alone: there is no grouping of notes into threads (ADR 0012).

## Vocabulary

Note (title, markdown content, type, date, tags, participants, tasks), Type (configurable identifiers; defaults `board_meeting`, `executive_meeting`, `sector_meeting`, `one_on_one`, `personal`, `other`), Participant (a person mentioned in the note's content, stored in `note_people`, ADR 0014), Mention (`@Name` in the content), Linked task (a task whose `source_note_id` is the note), Refinement (AI proposal awaiting explicit review).

## Data model

See `03-data-model.md` § notes, note_people, note_refinements. Invariants:

- NOTES-I01 `title` is 1–500 characters after trimming and `content` ≤ 50 000 (Zod; CHECK on title).
- NOTES-I02 `type` is null or an identifier from `notes.types`; when that setting is empty the six defaults apply. A disabled type stays valid on existing notes and is refused on create and on change (422 `NOTES-I02`).
- NOTES-I03 Tags ≤ 10, each ≤ 50 characters, deduplicated case-insensitively with the first spelling kept (Zod; CHECK on cardinality).
- NOTES-I04 A person appears at most once among a note's participants (partial unique index on `note_people (note_id, person_id) where deleted_at is null`). Removing a participant soft-deletes the row; adding again inserts a new row. Participants whose person is deleted are hidden until the person is restored.
- NOTES-I05 A task references at most one note (`tasks.source_note_id`). Attaching an existing task requires it to be open, top-level and unlinked (`TASKS-B16`).
- NOTES-I06 Trashing a note keeps `source_note_id` on its tasks; restore brings the relationship back untouched; purge nulls it (`TASKS-I06`). Trashing a note never trashes tasks.
- NOTES-B22 **AI acts on fields, not on the record.** Refining sits on the Content label row and tag suggestion on the Tags label row, each beside what it changes, not in a band above the record's title: they transform one field, a reader reaches for them while looking at that field, and at the top they took the first read from the note's own name. Refining keeps its words because it rewrites the reader's prose; tag suggestion is one icon, because the label beside it already supplies the noun and the action is additive and reversible — the reader ticks which tags to keep — and the whole exchange happens in a popover hanging off that icon so the field never leaves their sight. Refining is hidden while the note is empty rather than shown disabled: an action that cannot apply yet is not information. Where a capability is unavailable, its notice takes the same slot (ADMIN-B29).
- NOTES-B23 **Writing keys in the content textarea** (shared with task descriptions through `src/ui/markdown`). Enter after a list item starts the next item with the same marker: numbers advance and a checkbox comes back unchecked; Enter on an item that is only its marker ends the list by clearing the line; Shift+Enter and Enter with the mention list open keep their meanings. Tab on a list line indents it by its marker's width so it nests under the item above, Shift+Tab removes one such indent, a selection over several lines shifts every list line in it, and off a list line Tab keeps moving focus. Ctrl or Command with B wraps the selection in `**`, with I in `*`, each removing the marker when the selection is already wrapped and leaving the caret between a fresh pair when nothing is selected; with K it makes a link, the selected text as label with the caret in the empty address, or a selected address as target with the caret in the empty label; with Enter it leaves the field, which commits. Pasting an `http(s)` address over a selection links the selection to it. Combinations with Alt are left alone.
- NOTES-B24 **Timed commit while editing.** While the content textarea is being edited, a draft that differs from the last commit is committed five seconds after it first differs, whatever is typed meanwhile, so a long writing session is saved as it goes; leaving still commits a moved draft and never repeats the same text. A saved value that comes back equal to one of the field's own commits leaves the draft, which may have moved on, alone; any other change to the saved value re-bases the draft on it.
- NOTES-B25 **Checklist items toggle in the preview.** Each `- [ ]` or `- [x]` item renders as a real checkbox, named after its item text, that can be toggled from the preview without entering the textarea; toggling flips exactly that marker in the source and commits at once. The rendered preview and the button that opens the textarea are siblings so the checkboxes are not nested inside a control; clicking anywhere else still opens the textarea at the clicked text. Outside a preview (the standalone renderer) the checkboxes stay inert.
- NOTES-I07 Archive and delete are independent: an archived note can be trashed and is restored still archived.

## Behaviors

- NOTES-B01 **Create**: `title` required; `type` defaults to `notes.default_type` when that names an enabled type, otherwise stays empty; `noteDate` defaults to today in `ctx.timezone`; optional `content`, `tags`, `participantIds`. Committee and initiative references arrive with those modules; no meeting identifier is accepted (ADR 0012).
- NOTES-B02 **Views**: `all` (default; not archived, not deleted), `this_week` (`note_date` between today − 6 days and today), `type:<id>` for each enabled type (a note without a type appears only under `all` and `this_week`), `archived`, `trash`. Counts per view are computed under the same facets and search as the list. In every view except `trash`, archived notes are excluded unless `q` is non-empty, in which case they are included and flagged `archivedAt`.
- NOTES-B03 **Facets**: `type`, `tag`, `personId` (participant), `from` / `to` on `note_date`. AND semantics.
- NOTES-B04 **Search** `q` over title and content through `search_text`, and over tags and participant names by normalized match; Arabic normalization applies to all. The list's field is labelled `notes.searchList` ("Search notes", EP-B41).
- NOTES-B05 **Sort**: `note_date desc, created_at desc, id desc` (default), `title`, `created_at`; each with `id` tiebreak; keyset cursors.
- NOTES-B06 **Bands** for grouping, computed by one function `bandOf(noteDate, today)`: `upcoming` (`note_date > today`), `today`, `week` (within the previous six days), `month` (within the previous thirty days), `earlier`. No grouping in `trash`.
- NOTES-B07 **Detail** returns the note with `participants[]` (id, name, kind) and `tasks[]` (open first by due date then title, then completed by `completed_at` desc; each with id, title, status, priority, due date, owner name). PATCH carries `revision` and may change title, content, type, date, tags and `participantIds` (replaces the set). The content commits when the editor is left; the same patch carries the participants derived from its mentions (B08). Rendered content preserves single line breaks entered in prose instead of collapsing consecutive lines into one paragraph line.
- NOTES-B08 **Participants are the people mentioned in the content.** Typing `@` anywhere in the content opens a list of people filtered by the text after it; arrows move through the whole list and wrap, Enter or Tab inserts `@Name` at the caret, Escape closes, and the list stays closed for a name just picked until a new `@` is typed. An unknown name offers "Add <name>", which creates an external, non-assignable person through `POST /people` and inserts the mention. When the content is committed, `participantIds` is recomputed as the people (from the workspace directory plus the note's current participants) whose `@Name` appears in the content, so removing a mention removes the participant. There is no separate participants editor; mentions are plain text in the stored markdown.
- NOTES-B09 **Tasks panel**: "+ Task" creates a task with `sourceNoteId` set from a title-only inline row (`POST /tasks`). "Attach task" lists open top-level unlinked tasks (`GET /tasks?view=all&hasSourceNote=false&hasSubtasks=false`) and sets `sourceNoteId` by PATCH. Detach patches `sourceNoteId` to null. The complete toggle calls `POST /tasks/:id/complete`. Row counts `openTaskCount` and `doneTaskCount` come from the same statement as the list.
- NOTES-B10 **Archive** `POST /notes/:id/archive { revision }` sets `archived_at`; `unarchive` clears it. Archived notes keep every relationship.
- NOTES-B11 **Trash** soft-deletes with an op id; `restore { opId }` restores exactly that row; purge after `retention.trash_days`.
- NOTES-B12 **Bulk** `POST /notes/bulk/archive { items: [{ id, revision }] }` and `POST /notes/bulk/tag { items, tag }`, each one transaction: any stale revision → 409 `conflict reason: "revision"` naming the id and nothing changes; a note that would exceed ten tags → 422 `NOTES-I03` naming it and nothing changes; an already archived note or a note that already has the tag is left as is. Idempotent by key.
- NOTES-B13 **Tags** `GET /notes/tags` returns distinct tags over non-deleted notes with counts, sorted by count then name; used for the facet and the editor's autocomplete. Suggestions include only tags still used by at least one non-deleted note. The editor refreshes suggestions on focus, disables browser form-history suggestions, and excludes tags already selected case-insensitively. New tags may still be typed.
- NOTES-B14 **Home**: `homeSummary` contributes one section "Recent notes": non-archived notes with `note_date` within the last seven days, count and up to five items newest first, `href` to `notes?view=this_week`.
- NOTES-B15 **Person page**: the person detail shows a Notes section with the latest five notes where the person is a participant and a link to `notes?personId=<id>`; the notes module exposes `listNotes` for it.
- NOTES-B16 **Invalidation**: any note mutation invalidates `notes.list*`, `notes.counts`, `notes.detail(id)`, `notes.tags`, `home`, and the details of the people whose participation changed; task mutations invalidate `notes` (counts and panels).
- NOTES-B20 **Types are administered**: the note types (identifier, label per locale, enabled) and the default type are edited on the Administration → Note types page, which writes `notes.types` and `notes.default_type` (`ADMIN-B08`). Disabling a type keeps it on existing notes (I02); `GET /notes/types` returns the enabled types with labels and the resolved default.
- NOTES-B17 **AI**: Refine and Suggest tags enqueue revision-snapshotted jobs when the corresponding capability and model are available; otherwise routes return 503 `ai_unavailable`. The UI shows progress and proposals with explicit content/task/tag selection. Apply checks the source revision (stale → 409), creates selected linked tasks once and records the applied IDs. Discard changes no note content. Stale proposals offer regeneration. This implementation awaits verification.
- NOTES-B18 **Refinement review (Mission Control parity)**: A note with content has a Refine action when AI is available, with refining progress and retry on failure. A completed proposal replaces the editor with Refined Note and Suggested Tasks tabs, an expandable original captured from the job input, a change summary, selectable suggested tags and task cards showing status, priority, owner, due date and source snippet. Tasks and tags start selected. Task titles are editable (1–120 trimmed characters), with select/deselect-all controls. Apply Note Only applies refined content and selected tags; Apply Note & Tasks also creates the selected tasks using reviewed titles. Back to note (or Escape within the review) preserves the pending proposal for reopening; Discard dismisses it. Stale proposals cannot be applied and offer regeneration. All writes retain B17's transactional revision and repeat-apply guarantees. Prompt v2 mirrors Mission Control's structure guidance: meeting/planning/general sections as appropriate, minimal changes for short or already structured notes, no invented facts, existing-tag reuse. Mixed Arabic/English notes refine into Arabic while preserving names, technical terms and mentions; task titles retain their source passage's language. Existing prompt-v1 jobs remain executable. Development awaits tests/audits.


## API

| Verb | Path |
|---|---|
| GET | `/notes` (`view, q, type, tag, personId, from, to, sort, limit, cursor`) |
| POST | `/notes` (`NoteCreate`; 201; idempotent) |
| GET/PATCH/DELETE | `/notes/:id` (`includeDeleted`; PATCH `NotePatch` + `revision`) |
| POST | `/notes/:id/restore` `archive` `unarchive` |
| POST | `/notes/bulk/archive` `/notes/bulk/tag` |
| GET | `/notes/tags` ; GET `/notes/types` (enabled types with labels and the default) |
| POST | `/notes/:id/refine` and `/notes/:id/suggest-tags`; each also has `/apply` and `/discard` POST routes |

## UI

List on the entity framework. Row (NOTES-B02): compact full-width horizontal cards inspired by Mission Control, with subtle rounded borders and consistent small gaps. A small neutral identity dot precedes the title; titles use one line when they fit and at most two when long. Type/archive badges, completed/total linked-task progress and date form a compact trailing cluster, wrapping below on narrow screens. Tags and participant avatars are omitted from the cards to reduce clutter; they remain available in note details and existing filters. Task progress shows a semantic progress indicator and done/total count, with the open/done explanation available as a title and accessible label. Group headings are lightweight text/count labels, without filled bands. The weekly count remains in the views rail and in the compact header when the rail is hidden; there is no standalone statistics card. Rail: All, This week, one entry per enabled type, then Archived and Trash under a divider. Grouped by band (B06). Facets: type, tag, person. Bulk bar: Archive (confirm) and Add tag (dialog with autocomplete).

Detail: the title is the editable heading (labelled "Note title"), then type and date as label/value rows, participants as a read-only row of avatar chips that link to the person's page (like the owner link on a task), tags as chips with an autocomplete input (overflow beyond ten is blocked with a count), content shown as the rendered markdown (`src/ui/markdown`, ADR 0015) that turns into a textarea when entered (a click places the caret at the clicked text; keyboard entry at the end) and back into the preview when left, with `@` mentions, the writing keys (B23), a timed commit every five seconds while editing (B24), checklist boxes that toggle from the preview (B25), the tasks panel (B09) with completed tasks collapsed under a count, the shared entity footer (EP-B37) with relative "Updated", Archive and Move to trash. Autosave through the framework save queue; `revision` conflicts keep the draft.

Create: title, type ("No type" unless `notes.default_type` is set), date (today). Mobile: the panel bar reads Back · save state; tags below the title.

## AI

`notes.refine` (default model, dedup `notes.refine:<noteId>`) takes the note content, tags, type, locale and the names of assignable people and returns:

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
- ui: row, bands, detail edits, mention menu (filter, arrows, insert, dismissal, quick-create), derived participants, tag overflow block, tasks panel create/attach/detach/complete, editor enter and leave, writing keys (B23), timed commit and own round trip (B24), checklist toggle (B25), note types editor.
- e2e `notes.spec.ts`: A01–A12 in the listed locales.
- Mutation targets: `bandOf`, `bulkArchive`, `attachTask` (in tasks: `TASKS-B16` rule).

## Audit items

- The list with its counts is one SQL statement (query counter).
- Note content renders only through `src/ui/markdown`.
- `bandOf` has one definition used by grouping and the UI.

## Out of scope

Threads and merging (ADR 0012); a structural note-to-meeting relationship in v1 (ADR 0012); committee and initiative references; `linkedTo` facets (links core); attachments; pinning; private notes. AI refine and suggest tags are developed but await verification.

NOTES-B18 progress feedback appears immediately during submission, then distinguishes queued and running states with an animated spinner (respecting reduced motion), a polite live status and elapsed waiting time. The action is disabled and marked busy; previous errors/success messages are hidden during retries. Submission refreshes only its job query, retaining the note editor. No fabricated percentage is shown; completion or failure ends the indicator. Submission asks the user to keep the page open; accepted jobs explain that the user may return later and must explicitly apply changes.

NOTES-B17 tag generation uses a maximum 1024-token output allowance for new jobs and a 45-second provider-attempt deadline, including streaming. A deadline failure is terminal (no automatic retry) and offers a localized timeout explanation and manual retry. Other AI generation retains a five-minute provider-attempt deadline, now also covering response streaming. Progress shows a longer-than-usual message after thirty seconds in the running view. These limits bound waiting; they do not guarantee provider latency or successful output within the deadline.

- NOTES-B19 **Cancel generation**: Refinement and tag progress expose Cancel during submission, queuing and execution. During submission, remember the intent and request cancellation of the returned job ID; never cancel a previous job. Show Cancelling until terminal status, surface cancellation failures with retry, and confirm cancellation without applying changes. A member may cancel their own AI jobs; administrators may cancel any supported AI job. Queued cancellation completes immediately; running cancellation sets the durable flag, the runner observes active cancellation requests on its one-second tick and aborts the provider stream, and existing publication fences reject results after cancellation. If completion wins the transaction race, retain its review result. Repeated cancellation is harmless. Upstream usage already incurred remains recorded.

NOTES-B18 selected suggested tags have an accent background, accent border/ring, stronger text and a checkmark; unselected tags have a neutral outline and plus icon. The pressed state remains available to assistive technology, and shape/icon cues supplement color in both refinement and tag-only reviews.

NOTES-B18 elapsed waiting time uses the persisted job creation timestamp once accepted, including queue time and retries. Refreshing or reopening the note preserves elapsed time. Before acceptance it uses the current submission time; a new request starts a new timer.

NOTES-B18 Arabic action wording is «تحسين بالذكاء الاصطناعي»; settings use «تحسين الملاحظات» consistently.

- NOTES-B21 **Tag administration**: Administrators can search tag usage and select up to 200 source tags on `/admin/notes`, then confirm deletion (target null) or merging/renaming into a trimmed 1–50 character target. `GET /admin/notes/tags` includes archived and trashed notes. Admin-only, idempotent `POST /admin/notes/tags { tags, target }` atomically updates all matching notes including trash; matches are case-insensitive. Existing target tags are deduplicated with the requested target spelling; unrelated tags retain order. Revisions and audit entries update only changed notes, pending AI refinements become stale, and note content/deletion/archive state is preserved. Row locks and revision checks protect concurrent changes; absent sources are harmless. UI confirms sources and destination, disables controls while saving, shows errors or updated-note count, and invalidates notes/home/AI queries. No tag table or migration is needed.

## Committee integration (COMM-B03, COMM-B06)

Create and detail forms reuse the committee picker; cards show the assigned committee chip.
`committeeId` filters notes and view counts. Committee tabs reuse note rows, the create form
and autosaved detail panel. Assignment changes refresh committee summaries and activity.
Existing archived/trashed assignments remain readable and editable until explicitly changed.
