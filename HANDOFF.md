## Hand-off: WI-0001 — Phase 1 skeleton and UI skeleton, with a People preview slice
Status: incomplete — implementation in progress

### Plan
1. Read the binding specification and verify Docker/Node 22 tooling.
2. Bootstrap the existing documentation on main, then work only on feat/phase-1-skeleton.
3. Build tooling, static rules with violating fixtures, Docker targets, and audit entry points.
4. Build and test core persistence, authentication, jobs, storage, backups, HTTP, and AI infrastructure.
5. Build localized UI primitives and the shell.
6. Build and test the entity framework independently of People.
7. Add auth, Home, and scoped administration pages.
8. Add the persistent People preview with explicit deferred requirements.
9. Run audits, real-PostgreSQL scenarios, Docker restore drills, and bilingual browser tests.
10. Capture screenshots, record evidence, and commit each completed milestone.

### Summary
The specification was read in the work item's required order. Docker access was verified. The host has Node 26 and no pnpm; tooling runs in an isolated Node 22 container instead. Existing documentation was committed once on main as authorized, and implementation is on feat/phase-1-skeleton. No remote was added.

### Requirement → scenario
No implementation scenarios completed yet.

### Files changed
- Root: initial work-item hand-off.

### Migrations
None yet.

### Audits
Not run: tooling is being established. No passing audit claim is made.

### Manual verification
Not yet performed.

### Assumptions
1. The user explicitly authorizes the named dependencies and Phase 1 auth/settings/jobs/files/backup/AI infrastructure. These do not require repeating the generic escalation requests in docs/10-agent-workflow.md:32–34.
2. The work item's explicit People, framework, export, and AI-page deferrals take precedence over full-module completion requirements in docs/08-testing-strategy.md and docs/09-audit-checklists.md. Deferred IDs will be recorded, not assigned passing placeholder tests.

### Open questions
None recorded yet.

### Out of scope, noticed
None recorded yet.
