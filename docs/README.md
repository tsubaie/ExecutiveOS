# ExecutiveOS documentation

This folder is the specification. Implementation follows it; when they disagree, fix one or the other in the same PR.

## Reading order

| # | Document | Purpose |
|---|---|---|
| 01 | [Vision and scope](01-vision-and-scope.md) | What ExecutiveOS is, who it is for, what v1 contains, what it deliberately excludes |
| 02 | [Architecture](02-architecture.md) | Stack, module layout, request flow, jobs, AI, deployment |
| 03 | [Data model](03-data-model.md) | Every table, column, enum, relation, and invariant |
| 04 | [API conventions](04-api-conventions.md) | Route shape, validation, errors, pagination, auth |
| 05 | [UI guidelines](05-ui-guidelines.md) | Design system, entity page framework, mobile, i18n and RTL, accessibility |
| 06 | [AI integration](06-ai-integration.md) | Provider layer, jobs, prompts, structured outputs, safety, cost |
| 07 | [Coding guidelines](07-coding-guidelines.md) | Hard rules, naming, file limits, forbidden patterns |
| 08 | [Testing strategy](08-testing-strategy.md) | Test layers, what each feature must have, fixtures, CI |
| 09 | [Audit checklists](09-audit-checklists.md) | PR audit, module audit, security, a11y, i18n, release |
| 10 | [Agent workflow](10-agent-workflow.md) | How AI agents receive, execute, verify, and hand off work |
| 11 | [Roadmap](11-roadmap.md) | Phases, milestones, definition of done per phase |

## Feature specifications

| Spec | Module |
|---|---|
| [Home](features/home.md) | Landing page: next meetings, prep not ready, overdue actions, pending reviews |
| [Admin](features/admin.md) | Setup, users, settings, AI, learnings, backups, export, jobs, audit |
| [Entity pages](features/entity-pages.md) | Shared list + detail framework every module uses |
| [Tasks](features/tasks.md) | Tasks, subtasks, owners, bands, grouping |
| [Notes](features/notes.md) | Threads, notes, types, tags, AI refine |
| [Committees](features/committees.md) | Committees and their linked work |
| [KPIs](features/kpis.md) | Objectives, KPIs, readings, quarterly targets, status |
| [Initiatives](features/initiatives.md) | Initiatives, deliverables, progress, health updates |
| [Meetings](features/meetings.md) | Meetings, attendees, agenda, documents, AI briefs, minutes, actions |
| [People](features/people.md) | Directory of people linked across modules |
| [Links](features/links.md) | The context graph: contextual links plus projected structural edges |

## Decision records

`adr/` holds Architecture Decision Records. One decision per file, numbered, never edited after acceptance (superseded instead). See `adr/README.md`.

## Review response

`REVIEW-RESPONSE.md` maps every finding of the 2026-09-07 external review (`../SPEC-REVIEW.md`) to what changed and where.

## Templates

`templates/` holds the work-item template agents receive and the feature-spec template new modules must follow.

## Conventions used in these docs

- **MUST / MUST NOT** are hard requirements verified by audits or tests.
- **SHOULD** is the default; deviation requires a one-line justification in the PR.
- **MAY** is optional.
- Every feature spec has numbered invariants (`<MOD>-I<nn>`), behaviors (`<MOD>-B<nn>`), and acceptance criteria (`<MOD>-A<nn>`). Tests are named by these IDs and the docs audit cross-references them.
- Rules in guidelines are labeled **[static]**, **[runtime]**, or **[review]** by how they are enforced.
