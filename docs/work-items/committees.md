# Committees — Mission Control parity

**Current verification/publication:** see [GitHub publication](github-publication.md). The maintainer has resumed tests and audits; pause statements below describe the earlier development history.

Status: development; tests and audits paused by maintainer.

Implement COMM-B01–B06 task/note functionality using the shared entity cards, navigation,
autosave and create forms. Add schema/migration, CRUD/search/scope groups, task summaries,
committee assignment in Tasks/Notes, linked work tabs, activity and archive/trash/restore.
Verify through authored service and UI/browser scenarios when testing is authorized.

Scope: Mission Control committee fields and task/note integration. Meetings and general
contextual links remain dependent on their unimplemented modules; do not expose empty feature tabs.
New committee relationships use nullable foreign keys with ON DELETE SET NULL. Existing data is
preserved. Archive and soft delete keep linked work; assignment accepts active committees and
preserves existing archived/deleted assignments until explicitly changed.

Use UUID/revision/audit and authenticated handlers from this project rather than copying Mission
Control's integer IDs, fetch-in-component pattern or independent page state.

## Hand-off

Status: development implementation present; verification gate remains incomplete by maintainer instruction.

Shared code: EntityPage, RelatedEntities, EntityPanel, EntityCreateForm, ChoiceSelect,
revision/save queue, task/note rows and forms. No new dependency or external service.
Migration: `drizzle/0008_committees.sql`; empty/seeded upgrade tests not run.

| Requirement | Authored scenario |
|---|---|
| COMM-B01, I01, A04 | service: creates defaults and rejects case-insensitive duplicate names including restore |
| COMM-B02, B05, A01 | service: lists internal groups first and aggregates linked task counts without unrelated work |
| COMM-B03, B06, A02 | service: moving work updates both committee counts and filtered notes |
| COMM-B04, I02, I03, A03 | service: archive and trash preserve work and restore uses operation provenance |
| COMM-B03, A05 | service: activity includes linked work and committee actions without unrelated entities |
| COMM-B04 | service: manual reordering is revision-fenced and persists |
| COMM-A01, A04 | e2e: shared committee create and linked task workflow (en, ar) |

Scenario files: `src/modules/committees/tests/service.test.ts`, `e2e/committees.spec.ts`.
These scenarios have not been run. Full API, invalidation-map, browser acceptance and mutation
coverage remains for the requested later test/audit phase. `pnpm audit:all`: not run (paused).
Manual en/ar desktop/mobile checks: not run (paused).

Assumptions: (1) Match the reference's available task/note workflow while Meetings and Links are
unimplemented. (2) Match Tasks' top-level list when counting committee tasks.
Deferred broader-spec controls are recorded in the feature spec; not claimed as implemented.

Local hand-off evidence: `docker compose build app` completed successfully, including Next.js
compilation and TypeScript. The build reports 17 instrumentation/Edge-runtime and filesystem-tracing
warnings; these remain for the later audit phase. `docker compose up -d app` restarted the local app;
startup reached Next.js Ready after its migration/bootstrap hook. No remote deployment, test suite,
manual browser test, or audit was performed.

## Backup import follow-up

The maintainer requested importing committee records from a Mission Control SQL backup into
localhost. Four active records were found (two internal, two external). Only the committee COPY
section is decoded as data; backup SQL is never executed. The import uses the committee service
in one transaction, skips equal existing names, and aborts on conflicting existing fields.

The first transaction rolled back because the read schema inherited strictness from CommitteeCreate
and rejected the generated `searchText` column. Committee read validation now strips internal query
columns, including cursor metadata, while create/patch input validation stays strict. Existing
COMM-B01/B02 service scenarios cover creation/readback and listing; execution remains paused.

Import completed: four records inserted, zero existing records overwritten. A read-only follow-up
matched all four records to their source fields. The local image rebuilt successfully and the app
restarted. No tests, audits or remote deployment were run for this follow-up.
