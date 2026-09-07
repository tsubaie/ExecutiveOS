# 10 — Agent workflow

ExecutiveOS is built primarily by AI coding agents supervised by a human maintainer. This document defines how work is packaged, executed, verified, and handed back so that quality does not depend on any single agent's judgment.

## Roles

| Role | Who | Responsibility |
|---|---|---|
| Maintainer | Human | Writes or approves work items, reviews PRs, merges, decides escalations |
| Implementer | Agent | Executes one work item on a branch, produces a PR and a hand-off |
| Reviewer | Agent (different session) or human | Runs the PR audit, challenges tests, checks spec parity |
| Auditor | Agent, scheduled | Runs module, security, and i18n audits on `main`, files issues |

An agent never reviews its own PR.

## Document precedence

1. An accepted ADR for the decision it records.
2. The feature spec for behavior.
3. `07-coding-guidelines.md` for how code is written; `04` and `05` for API and UI conventions.
4. `AGENTS.md` and this document for process.

Two documents of the same rank in conflict → escalate. Never pick one silently.

## Assumptions versus escalation

An implementer MAY make an assumption and continue when all of the following hold: the gap is inside the work item's scope; the assumption is the most conservative reading (least data change, least new surface); it does not touch any escalation trigger below; and it is recorded as a numbered assumption in the hand-off with the spec line it fills. The reviewer confirms or reverses it, and the confirmed version is written into the spec in the same PR.

An implementer MUST stop and escalate when the work would:

- add, rename, or drop a column with data, or change the relationship inventory;
- touch auth, sessions, settings registry, jobs runner, files storage, backup, or the AI provider;
- contradict a spec section or an ADR, or require choosing between conflicting documents;
- add a dependency or an external call;
- change a requirement ID's meaning or an acceptance criterion;
- need a product decision (what the user sees or can do) not covered by the spec.

Escalation means: commit the partial work as `wip:`, write the hand-off with "Status: blocked" and the precise question(s) with options and a recommendation, and stop.

## Work items

Work is assigned using `docs/templates/work-item.md`: goal, scope, numbered requirements referencing spec IDs, acceptance criteria, constraints, hand-off expectations. Vague work items are rejected with the list of blocking questions.

## Implementer procedure

1. **Read** `AGENTS.md`, the work item, the feature spec, `07`, the relevant ADRs, and the module's `service.ts` doc comment and existing scenarios.
2. **Plan**: 5 to 15 lines at the top of the hand-off draft: files, scenarios to add, migrations, i18n keys, assumptions so far.
3. **Branch** from up-to-date `main`.
4. **Scenarios first**: for each requirement ID, write the failing scenario before the implementation.
5. **Implement** within the module manifest. Reuse before writing.
6. **Localize** as you go.
7. **Verify**: `pnpm audit:all`; the module's e2e locally; manual golden path in `en` and `ar` on desktop and 390 px.
8. **Document**: spec updates for behavior; a new ADR for any decision; assumptions into the spec once confirmed.
9. **Hand off** with the template below. Commit with conventional messages. Do not push or open a PR unless the work item says so.

## Hand-off template

```
## Hand-off: <work item id> — <title>
Status: complete | incomplete (what remains) | blocked (questions below)

### Summary
3 to 6 sentences.

### Requirement → scenario
| ID | Test file | Scenario name |

### Files changed
By module, one line each.

### Migrations
None | drizzle/<file>: purpose; applied to empty and seeded DB.

### Audits
`pnpm audit:all` summary. Warnings and why acceptable.

### Manual verification
en desktop ✔ / ar desktop ✔ / en 390px ✔ / ar 390px ✔ (or what failed)

### Assumptions
Numbered; spec line each fills; recorded where.

### Open questions
Numbered; options; recommendation.

### Out of scope, noticed
File references.
```

## Reviewer procedure

1. Reject immediately if the requirement → scenario table is missing or incomplete.
2. Run `pnpm audit:all` and the module tests yourself.
3. For each scenario: would it fail if the implementation were reverted? Spot-check by reading; for the module's critical functions, run `pnpm test:mutate`.
4. Walk the module audit items relevant to the change.
5. Check spec parity in both directions.
6. Search for near-duplicate functions and components (`pnpm audit:dupes` runs jscpd on the diff).
7. Confirm or reverse each assumption; ensure confirmed ones are in the spec.
8. Findings as a list: blocker, should-fix, nit, with file:line.

## Conventions that keep agents safe

- Never guess product behavior. Never widen scope. Never delete a test to pass CI. Never disable a lint rule inline. Never touch `main`, remotes, secrets, or production data.
- Prefer boring code another agent can read without context.

## Session hygiene

One work item per session. Learnings that are not derivable from the repo go into an ADR (decisions) or the spec (behavior); there is no memory file in the repo. A session ending mid-work commits `wip:` and writes an incomplete hand-off.
