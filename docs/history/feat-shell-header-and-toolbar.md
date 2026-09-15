# Hand-off: shell header and entity toolbar — search, notifications, account

Status: complete

## Summary

Two pieces of work on one branch. The entity list's header was spending 200 px of a desktop screen
and 359 px of a phone's saying things the rail beside it was already saying, and everything it drew
under the open record's panel was still focusable; it is now one wrapping row of 67 px that keeps
clear of the panel. The shell header above it carried the workspace name — which the sidebar foot
already says in a heavier weight on the same screen — and two preference toggles; it now carries
workspace-wide search, a notification centre and the account menu, and the reader's own settings
have a page of their own at `/account`.

Three ADRs record the decisions that were not already written down: how global search is answered
(0021), what a notification is and is not (0022), and why the route bundle budget moved (0023).
`01-vision-and-scope.md` is amended: what it ruled out was notification *delivery* — check-in, push
and mail — and that stays out.

## Requirement → scenario

| ID | Test file | Scenario name |
|---|---|---|
| EP-B32, EP-B35 | `e2e/tasks.spec.ts` | TASKS-B02 TASKS-B08 EP-B20 task cards retain an independent completion control and rounded Inbox-first summaries |
| EP-B33 | `src/ui/entity/tests/mode.test.tsx` | the mode reaches the list query under its own key and is not rendered among the filters |
| SEARCH-B01, B03 | `src/core/search/tests/merge.test.ts` | SEARCH-B03 interleaves modules…; SEARCH-B01 escapes wildcards… |
| NOTIF-B01, B04 | `src/modules/notifications/tests/service.test.ts` | writes one row for the assigned person and names the actor |
| NOTIF-B02 | same | does not notify the reader of their own action |
| NOTIF-B03, I02 | same | refreshes an unread notification rather than stacking it; inserts again once the first has been read |
| NOTIF-B04 | same | writes nothing for a person with no account |
| NOTIF-B06, B08 | same | drops a notification whose subject is gone, without deleting the row |
| NOTIF-B07 | same | marks read only what the reader could actually see |
| NOTIF-I04 | same | never returns another reader rows |
| ACCT-B01 | `src/modules/account/tests/service.test.ts` | rejects an address another account already holds; lowercases a changed address |
| ACCT-B02 | same | refuses a wrong current password; keeps the session it was made in and revokes every other |
| ACCT-B03 | same | marks the requesting session as the current one; revokes only the reader's own |
| ACCT-I02 | same | has no way to name a role or an active flag in a patch |
| ACCT-I03 | same | clearing a preference removes the row so the workspace default reaches the reader |

## Files changed

- `src/ui/entity/` — one wrapping toolbar row, the facets and the outside banner split out, the
  stats strip and view summary conditioned on the rail, sort and mode no longer counted as filters.
- `src/ui/layout/` — `ShellHeader`, `SearchPalette`, `AccountMenu`/`AccountPanel`/`AccountActions`.
- `src/core/search/` — types, merge, service, api; `src/core/db/search.ts` for the shared predicate.
- `src/core/notifications/` — `emit.ts` (write side, free of the registry) and `retention.ts`.
- `src/core/db/` — `notifications-repo.ts`, the `notifications` table, account and session queries.
- `src/modules/<m>/search.ts` — five providers; `tasks|notes/notifications.ts` — kinds and subjects.
- `src/modules/account/`, `src/modules/notifications/` — two new modules.
- `docs/` — ADRs 0021–0023, three feature specs, EP-B32–B35, the vision and architecture amendments.

## Migrations

`drizzle/0014_notifications.sql` — the table, its feed index, and the partial unique index that
makes emission an idempotent upsert. `drizzle/0015_notifications-actor-index.sql` — the FK index
`audit:schema` requires. Both additive; no existing table is altered. Applied to the seeded
development database and to an empty test database.

## Audits

- `audit:static` — 0 violations (i18n 40, docs 13, tests 9 warnings, all pre-existing).
- `audit:schema` — 0 violations. `pnpm test` — 378 passed, 79 files.
- `audit:browser` — build, `audit:bundle` 0 violations (see ADR 0023), `test:e2e` 94 passed on a
  fresh test database, `audit:openapi` 0, `audit:a11y` 0, `audit:perf` 0 (5 warnings).

`pnpm audit:all` cannot complete as one chained command against a single test database: `audit:data`
leaves the workspace initialized, and the e2e global setup then finds no credentials for it. Run the
phases with the disposable database restarted between them. Worth fixing separately.

## Manual verification

en desktop ✔ / ar desktop ✔ / en 390 px ✔ / ar 390 px ✔ — including an overflow sweep of every
route at 390 px and 1440 px in both directions, the palette by ⌘K, the account menu, and the bell
with a real `task.assigned` between two accounts.

## Assumptions

1. **In-app notifications are in scope; delivery is not.** `01-vision-and-scope.md` ruled out
   "daily check-in and push notifications". Read as ruling out delivery, the line now names push,
   check-in and mail explicitly and points at `features/notifications.md` for the pull-only centre.
   Confirmed with the maintainer before any code was written.
2. **`currentSessionHash()` was added to `core/auth/session.ts`**, which the workflow lists as an
   escalation trigger. It is read-only — it digests the cookie the request already carries — and
   ACCT-B02/B03 cannot be implemented without knowing which session is making the request.
3. **`Theme` and `Timezone` are exported from `core/config/settings.ts`.** No registry entry
   changed; the account's validation needed the same schemas the registry already uses.
4. **The shipped notification kinds are `task.assigned` and `note.mentioned`.** The other four are
   declared in the spec and in the `kind` constraint and are not yet emitted (see below).

## Open questions

None blocking.

## Out of scope, noticed

- **Four notification kinds are declared and not emitted**: `task.due_today` and `task.overdue`
  need a scheduled job under the ADR 0010 contract plus a `schedules` row; `kpi.off_target` needs an
  emitter in the KPI reading path; `job.finished` needs one in the job runner. The retention job
  (`system.notifications_purge`) is registered but has no schedule row either.
- **Only Tasks and Notes resolve notification subjects.** Committees, KPIs and People declare no
  `notifications` contribution, so a kind naming one of them would be dropped from the feed.
- **The statistics strip still costs 198 px on a phone** (`EntityViews.tsx`). It is not duplication
  there — no rail exists — but it is over half the header on a 390 px screen.
- **`audit:bundle` measures reachability, not loading** (`scripts/audit/bundle.ts`), so a `lazy()`
  boundary cannot help a route meet it. ADR 0023 names the 83.5 KB vendor Zod chunk as the standing
  candidate for getting the worst route back under 250 KB.
- **`e2e/preview.spec.ts:126` (HOME-B02) is flaky** — its assertions are about absence and race
  Home's first render. It passed 94/94 in one full run and failed in the next, and passes in
  isolation. Pre-existing; nothing in this branch touches Home sections.
- **`eos/no-literal-strings` flags every `aria-*` attribute with a literal**, including ARIA tokens
  like `aria-haspopup="dialog"` that are not user-visible text. `EntityTable.tsx` only escapes it
  because a conditional expression is not a `Literal` node.
