# Work item: WI-0002 — Notes core

**Module:** notes (touches tasks, people, home, ui)
**Spec sections and requirement IDs:** docs/features/notes.md → NOTES-I01–I07, NOTES-B01–B17, NOTES-A01–A11; docs/features/tasks.md → TASKS-B16; docs/features/entity-pages.md → EP-A05; docs/features/home.md → HOME-B01; docs/features/people.md → PEOPLE-B03
**Phase:** 3
**Size:** L (split into three commits on one branch: docs, data and API, UI)

## Goal

Ship standalone notes with participants, tags and linked tasks on the entity framework, in both locales, without AI.

## Scope

- Expected files or folders: `src/modules/notes/**`, `src/app/(app)/notes`, `src/app/api/v1/notes/**`, `drizzle/0004_notes.sql`, `src/ui/markdown/**`, `src/modules/tasks` (source note column, `TASKS-B16`, `hasSourceNote` facet, source note chip), `src/modules/people/ui/PersonDetail.tsx` (Notes section), `src/modules/home` (section wiring only), `src/core/i18n/messages/{en,ar}.json`, `src/core/routes.ts`, `e2e/notes.spec.ts`, `docs/**` as listed in the docs commit.
- Out of scope: threads and merge (removed by ADR 0012); AI refine and suggest tags (Phase 3b); `linkedTo` facets (links core); committee, initiative and meeting references; attachments; admin editor for `notes.types` (ADMIN-B08).

## Requirements

1. NOTES-I01–I07 as specified, each with a service scenario and, where a constraint exists, a constraints scenario.
2. NOTES-B01–B16 as specified. B17: the refine and suggest-tags routes exist and return 503 `ai_unavailable`.
3. TASKS-B16: `sourceNoteId` on create and PATCH with the attach rule; `hasSourceNote` and `sourceNoteId` list facets; `sourceNote` on task detail.
4. EP-A05 (bulk archive and bulk tag through the framework bulk bar), HOME-B01 item 9, PEOPLE-B03 Notes section.
5. ADR 0015 markdown component under `src/ui/markdown` used for note preview and task description preview.

## Acceptance criteria

NOTES-A01–A11 in the listed locales; EP-A05.

## Constraints

- Migration: allowed (`0004_notes.sql`: `notes`, `note_people`, `tasks.source_note_id`, indexes, checks).
- New dependencies: allowed only `react-markdown`, `remark-gfm`, `rehype-sanitize` (ADR 0015).
- Escalation triggers expected: none beyond the above, which the maintainer approved in the planning session of 2026-09-10.

## Hand-off expectations

- `pnpm audit:all` summary
- Requirement → scenario table
- Manual verification in en and ar, desktop and 390 px, with screenshots under `docs/screenshots/notes-*`
- Push / PR: not allowed; branch `feat/notes-core` stays local
