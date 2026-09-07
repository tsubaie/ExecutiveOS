# 01 — Vision and scope

## What ExecutiveOS is

ExecutiveOS is a self-hosted operating surface for an executive and the small team around them. It answers, from one screen: what needs my decision, what is overdue, what did we agree in the last meeting, how are our KPIs and initiatives doing, and what should I do next.

It is opinionated software. It is not a general project-management tool, not a CRM, and not a chat app. It models the way an executive office actually works: recurring bodies (committees and boards), meetings that produce documents, notes and actions, a scorecard of KPIs, and a portfolio of initiatives.

## Who it is for

- **Principal:** the executive the installation serves (CEO, VP, director, board member). Identified in settings as `workspace.principal_person_id`; briefs and summaries are written for this person.
- **Operators:** the executive's office: chief of staff, executive assistant, strategy or PMO staff who maintain data and prepare material on the principal's behalf. The principal is usually also an operator.
- **Installation model:** one installation serves one executive office. All members share the same data except fields the specs mark private. There are no tenants inside an installation. v1 supports one application instance plus one PostgreSQL database.

## Product principles

1. **Decision-ready, not data-heavy.** Summaries first, detail on click. Every list has a default view that shows what needs attention.
2. **One surface, linked.** Structural relationships (task→committee, task→source note, meeting→committee) are typed columns. Everything else connects through a context graph with a fixed relation vocabulary. Notes always remain independent entities; contextual links never group or collapse them. "Everything about this person or meeting" is one query.
3. **Fast and explainable.** No opaque scoring. When something is flagged (overdue, off target, at risk) the reason is visible.
4. **Bilingual by design.** English and Arabic are both first-class, including right-to-left layout, mixed-direction text, and Arabic typography. Other locales can be added by contributing a message catalog. Calendar is Gregorian in v1.
5. **AI proposes, humans decide.** AI produces refined notes, extracted tasks, briefs, drafts, and proposed prompt learnings. Nothing AI produces changes shared data or future AI behavior without an explicit user action.
6. **Boring, reliable, self-hostable.** One container plus Postgres. No external workers, no separately installed tools, no cloud lock-in. Backups, restore, and export are first-class.
7. **Built for agents.** The codebase is structured so AI coding agents can implement, test, and audit features without guesswork. Requirements have IDs; rules are labeled static, runtime, or human-reviewed; audits are scripts where they can be.

## v1 scope

| Module | In v1 |
|---|---|
| Home | Yes. A small landing page: next meetings, prep failures, overdue actions, pending AI reviews. `features/home.md` |
| Tasks | Yes. `features/tasks.md` |
| Notes | Yes. Thread-first notes with AI refine. `features/notes.md` |
| Committees | Yes. `features/committees.md` |
| KPIs | Yes. Objectives, KPIs, readings, quarterly targets. `features/kpis.md` |
| Initiatives | Yes. Deliverables, progress, health updates. `features/initiatives.md` |
| Meetings and Meeting Prep | Yes. Attendees, agenda, documents, AI briefs with reviewed learnings, minutes, actions. `features/meetings.md` |
| People | Yes. Directory and the single identity for task owners and attendees. `features/people.md` |
| Links | Yes. Context graph. `features/links.md` |
| Admin | Yes. Users, settings, backups, jobs, audit log, AI usage, learnings review. `features/admin.md` |
| AI | Yes. Note refine, tag suggestion, task breakdown, initiative update draft, meeting brief, brief translation, learnings proposal. `06-ai-integration.md` |

## Explicitly out of v1

- Insights and daily briefing generation (Home is a query, not an AI product)
- Relationship cadence tracking and reminders (People ships; follow-ups do not)
- Daily check-in and push notifications
- Email, calendar, Notion, or Drive integrations, including calendar sync for Meetings
- Writing / book workspace
- Public API tokens for third-party clients
- Multi-instance clustering and multi-tenant SaaS mode
- Hijri calendar display
- DOCX to PDF conversion (DOCX is analyzed as text)

These are listed so that agents do not build toward them speculatively. Do not add columns, routes, or navigation for out-of-scope modules.

## Non-goals (permanent)

- Real-time collaborative editing
- A general-purpose Kanban or Gantt tool
- A full email client
- Automatic actions taken by AI without user confirmation

## Success criteria for v1

1. A new operator can run `docker compose up`, complete setup with the printed setup token, and create a task within five minutes.
2. All modules pass their acceptance criteria and module audits.
3. The interface is fully usable in Arabic with RTL layout and in English with LTR layout, switchable per user.
4. AI refine on a real meeting note produces a restructured note and a list of extractable tasks, and applying them creates real tasks linked to the note.
5. The test suite runs green in CI on every PR and includes end-to-end coverage of each module's golden path plus the adversarial core suite (races, crash recovery, duplicate submissions, cross-user privacy).
6. The database can be rebuilt from migrations alone; a backup can be restored with one command and the restored files verify against the manifest.
7. Uploading a board paper to a meeting produces an eleven-section executive brief in the user's language; feedback becomes a learnings proposal an admin can activate; the next brief's prompt contains the active learnings.

## Terminology

| Term | Meaning |
|---|---|
| Installation | One deployed ExecutiveOS instance and its database |
| Workspace | Synonym for installation in UI copy; there is exactly one |
| Principal | The executive the workspace serves; a `people` row referenced in settings |
| Member | Any authenticated user |
| Admin | A member who can manage users, settings, backups, AI, and learnings |
| Person | A `people` row; may be assignable (can own tasks) and may be a member |
| Entity page | A list + detail screen built with the shared framework |
| Band | A due-date grouping in the task list (Overdue, Today, This week, Later, Undated) |
| Structural edge | A relationship stored as a typed column or junction row and projected into the graph |
| Contextual edge | A row in `entity_links` connecting two entities with a relation |
| Brief | The AI-generated executive analysis of a meeting document |
| Learnings | Reviewed guidance derived from brief feedback, injected into future brief prompts once activated |
| Requirement ID | `<MODULE>-B<nn>` for behaviors, `<MODULE>-A<nn>` for acceptance criteria; tests reference them |
