## Hand-off: Tasks UX foundation
Status: complete — UX correction pass verified; inherited preview/spec gaps are listed below.

### Plan
- Inspect real Tasks list, detail and create in English/Arabic at desktop and mobile sizes.
- Record interaction failures, not just styling preferences, in this hand-off.
- Add regression scenarios for URL filters, keyboard selection, responsive panels and form feedback.
- Improve shared entity layout, filtering, selection and navigation before module-specific presentation.
- Improve Tasks readability, touch targets, property density and validation feedback.
- Recheck People because it consumes the same framework.
- Verify focused lint, types, dependency boundaries, PostgreSQL tests and browser workflows.
- Capture screenshots and deploy the Docker preview; preserve existing records.
- No migrations, new dependencies, accepted ADR edits or external services.

### Assumptions
1. This branch starts from feat/tasks-management, the running implementation; main still contains documentation only (docs/10, Implementer procedure §3).
2. The user's explicit request authorizes UI interaction/layout fixes within existing Tasks and entity-page behaviors. No schema, auth or other escalation-triggering subsystem changes are planned (docs/10, Assumptions versus escalation).
3. A collapsible views rail and filter sheet implement EP-B07/B08; exact spacing and breakpoint behavior are implementation choices (docs/05, Responsive behavior).

### Baseline findings
- Shared toolbar spends three rows on search, filters and inactive bulk actions; mobile list content starts too low.
- Permanent selection and completion checkboxes are adjacent, tiny and visually ambiguous.
- Shared 240px rail plus 480px panel leaves an unusably narrow list at smaller desktop widths.
- Clear filters and Show in All retain facet filters; empty state fails to recognize facets.
- Detail navigation does not disable unavailable neighbors; next-page action fetches without advancing.
- Task property fields consume excessive vertical space; invalid blank title edits silently fail to save.
- Group headers repeat under alternate sorting; row titles truncate useful context.
- Close focus occurs before the mobile list becomes visible; keyboard arrows can leave detail unexpectedly.

### Migrations
None.

### Confirmed findings and fixes
| Severity | Finding / source | Change |
|---|---|---|
| Major | Two adjacent completion/selection controls and inactive bulk toolbar obscure the primary action (docs/features/entity-pages.md:52; docs/05-ui-guidelines.md:49). | Explicit selection mode; completion hidden during selection; 44px checkbox targets; keyboard x toggles selection. |
| Major | Mobile filters and view controls consume excessive list space (entity-pages.md:57). | Search plus compact filter/selection controls; facets and views in a Base UI sheet, with active facet count. |
| Major | Fixed rail/detail widths squeeze the list at small desktop sizes (entity-pages.md:56). | Rail auto-collapses below 1280px; detail uses up to 480px and half the workspace; wider desktops expose a rail toggle. |
| Major | Clear filters and Show in All retain owner/priority facets (entity-pages.md:46,70). | One shared clear-filter operation clears every registered facet and selection; Show in All retains the requested id. Banner appears inside detail on mobile. |
| Major | Save failure can be bypassed by view/row/create navigation (entity-pages.md:63). | Framework navigation and application links wait for the save queue and show Retry/Discard on failure; browser unload warns while a save is unresolved. |
| Major | Save queue's revision can lag completion/reopen or lead rendered detail (tasks.md:46). | Delete uses the newest revision known to the editor or save queue. |
| Major | Mobile close focuses a hidden list; arrows move focus out of detail (entity-pages.md:52,72). | Restore focus after the list renders; scope list arrows to the list state; disable unavailable previous/next controls. |
| Major | Blank title edits silently fail (docs/05-ui-guidelines.md:40). | RHF/Zod localized title/description validation, visible errors, and native validity check before shared navigation. |
| Major | Mobile shell navigation and detail transitions create horizontal overflow (docs/05-ui-guidelines.md:62). | Icon-over-label bottom navigation; independently scrolling work area clips its own slide transition. |
| Major | Light-theme selected-row metadata fails contrast (docs/05-ui-guidelines.md, Accessibility). | Surface background plus accent outline replaces the tinted selected-row background. |
| Minor | Task property and subtask fields waste vertical space (docs/05-ui-guidelines.md, Density). | Two-column property grid, full-width selects, shorter notes field, compact subtask action row; destructive parent action follows subtasks. |
| Minor | Alternate sorts repeat misleading due-band headings (tasks.md, Views and sorting). | Shared framework only renders due groups under default ordering. |
| Minor | ISO dates and truncated titles reduce readability (docs/05-ui-guidelines.md, Internationalization). | Localized Gregorian dates, Today label, two-line titles and priority emphasis using semantic tokens. |
| Minor | Detail actions scroll away and saved status persists indefinitely (entity-pages.md:62). | Sticky detail toolbar, visible mobile Back label, Saved announcement expires after two seconds. |

### Scope limits for propagation
This is a UX correction pass over the existing preview, not completion of every deferred requirement from TASKS-HANDOFF.md. Do not infer full EP-B06/B10/B11/B13/B14/B17 compliance from the covered scenarios: range selection and bulk keyboard menu, conflict diff confirmation, blocking browser history traversal during a failed save, scroll-triggered paging, persisted group collapse, and create-draft navigation protection still need dedicated implementation. Normal browser Back and guarded framework/application-link navigation are covered separately. Owner options still use the preview's first 200 assignable people. No AI, new modules, schema migrations, drag/swipe interactions or auth changes were added.

### Additional assumptions
4. EP-B07 (docs/features/entity-pages.md:56): the nominal 480px detail width is a maximum at constrained desktop widths, and the collapsible rail starts hidden below 1280px. This preserves a usable list and is recorded for maintainer review.
5. EP-B08 (docs/features/entity-pages.md:57): mobile detail uses the full entity workspace while retaining global shell controls and bottom navigation.
6. docs/05-ui-guidelines.md:9: multi-line task rows may exceed the nominal row density so titles, ownership and dates remain readable; interactive targets are at least 44px.


### Summary
The Tasks page now uses the shared framework for a compact responsive list, explicit selection mode, filter sheet, debounced URL search, guarded save navigation and focus restoration. Tasks use larger completion targets, readable dates/titles, denser properties and subtasks, and localized text-field validation. The same layout fixes apply to People and its browser regressions pass. This does not certify the entire previously incomplete Phase 1/2 specification.

### Requirement → scenario
Coverage below describes the exercised behavior, not blanket completion of each ID.

| ID | Test file | Scenario / coverage |
|---|---|---|
| EP-B01, EP-B02 | e2e/tasks.spec.ts | Search keeps typing focus, debounces and follows browser history; existing URL precedence tests remain. |
| EP-B03 | src/ui/entity/tests/filter-state.test.ts; e2e/tasks.spec.ts | Show in All preserves the deep link and clears all facets; banner visible on mobile. |
| EP-B06 | e2e/tasks.spec.ts | Keyboard x selection, Escape clears selection, list focus restoration; range/bulk shortcuts remain deferred. |
| EP-B07, EP-B08, EP-B09 | e2e/tasks.spec.ts; tools/capture-tasks.mjs | Usable list width at 1024/1280, filter sheet, mobile detail, en/ar and no horizontal overflow at 320/390. |
| EP-B10 | e2e/tasks.spec.ts; src/ui/entity/tests/save-queue.test.ts | Queued failure retains draft; explicit retry saves; conflict reapply preserves untouched fields; two-second saved announcement. Diff confirmation remains deferred. |
| EP-B11 | e2e/tasks.spec.ts | Failed save blocks view change, Retry persists edit before continuing. Normal browser Back is separately tested; failed-save history blocking remains deferred. |
| EP-B13 | src/ui/entity/tests/neighbors.test.ts | Next at a loaded-page boundary fetches before opening the next row; scroll-triggered paging remains deferred. |
| EP-B15 | src/ui/entity/tests/filter-state.test.ts; e2e/tasks.spec.ts | Facet-aware empty state and complete filter clearing. |
| EP-B17 | e2e/tasks.spec.ts | Close returns focus to the visible row; unavailable previous/next actions are disabled. |
| TASKS-A01, TASKS-A03, TASKS-A04, TASKS-B08, TASKS-B15 | e2e/tasks.spec.ts | Create/edit, subtasks, completion/reopen, parent delete/restore in en/ar, desktop/mobile. |
| TASKS-A05, TASKS-B09 | e2e/tasks.spec.ts | Enter explicit selection mode, select tasks, group under a named parent. |
| TASKS-A09, TASKS-B12 | e2e/tasks.spec.ts; src/ui/entity/tests/save-queue.test.ts | Stale editor retry and correct revisions through queued edits / later actions. |
| PEOPLE-B01/B02/B03/B06, PEOPLE-A05 | e2e/preview.spec.ts | Existing create/edit/duplicate/trash/restore regressions pass with the shared layout. |
| docs/05 touch/RTL/accessibility | e2e/tasks.spec.ts; tools/capture-tasks.mjs | 44px completion control, 48 combinations of list/detail/create × en/ar × four viewports × two themes, axe and overflow assertions. |

### Files changed
- `src/ui/entity`: shared layout, controls, filter/search state, selection, keyboard/focus, save/link guard and regression tests.
- `src/ui/primitives`: reusable Base UI sheet variant and full-width native selects.
- `src/ui/layout`, `src/ui/tokens.css`: shared shell navigation rendering, safe-area mobile navigation and transition bounds.
- `src/modules/tasks/ui`: text validation, compact properties/subtasks, readable rows, completion targets and grouping eligibility.
- `src/core/i18n/messages`: matching English/Arabic control and validation messages.
- `e2e/tasks.spec.ts`, `tools/capture-tasks.mjs`: regression scenarios and repeatable visual/accessibility matrix.
- `docs/screenshots/tasks-*`: refreshed 12 baseline images plus 36 light/narrow/tablet variants. No accepted ADR or prose specification was changed.

### Audits and verification
- Docker production build: passes; existing instrumentation/Node and backup dynamic-import warnings remain.
- TypeScript: passes.
- Dependency boundaries: passes (251 modules, 776 dependencies at final check).
- Focused ESLint on entity framework, Tasks UI, new shell links, primitives and capture script: passes. The shell retains its existing logout navigation warning.
- Unit/integration suite: 56 tests passed; the additional rendered React pagination regression also passed (57 total). PostgreSQL integration tests use the separate `_test` database.
- Playwright: all 18 scenarios passed, including existing People/Admin regressions.
- Screenshots: 48/48 pass; no horizontal document overflow, serious/critical axe violations or browser runtime errors.
- `pnpm audit:all` is not green. It stops on inherited oversized jobs/People/Admin/Auth functions and the existing shell logout navigation warning. No rules were disabled or weakened. Remaining runtime audit-script gaps from the original preview are still documented in HANDOFF.md.

### Manual verification
en desktop ✔ / ar desktop ✔ / en 390px ✔ / ar 390px ✔. Also checked 320px and 1024px in both themes; browser scenarios measure usable list width at 1280px. Screenshots use invented task records and a query that excludes existing user tasks. Existing application data was not reset.

### Run / inspect
The local preview is running at **http://localhost:3000/tasks?view=all**. Use your existing account; local preview credentials remain in ignored `tmp/PREVIEW-LOGIN.md`.

From the repository:
```sh
docker compose up -d --build
```
For this workspace's existing tooling container:
```sh
docker exec executiveos-wi0001-tooling pnpm typecheck
docker exec executiveos-wi0001-tooling node --env-file=.env.test node_modules/vitest/vitest.mjs run
docker exec executiveos-wi0001-tooling pnpm exec playwright test --config tools/playwright-docker.config.ts
docker exec executiveos-wi0001-tooling node tools/capture-tasks.mjs
```
Open `docs/screenshots/tasks-list-ar-mobile.png`, `tasks-detail-en-tablet-light.png`, or any `tasks-<list|detail|create>-<en|ar>-<desktop|mobile|narrow|tablet>[-light].png`. The screenshot runner creates and soft-deletes only its own fixtures.

### Open questions
No permission is pending. Before propagating the framework as feature-complete, schedule the remaining scenario gaps listed under Scope limits for propagation. The conservative responsive width assumptions above need maintainer review alongside this work.

### Repository-wide audit output
```text
> executiveos@0.1.0 audit:all /workspace
> pnpm lint && pnpm typecheck && pnpm depcruise && pnpm audit:structure && pnpm audit:i18n && pnpm audit:portability && pnpm audit:docs && pnpm audit:schema && pnpm audit:tests && pnpm audit:deps && pnpm audit:secrets && pnpm test && pnpm build && pnpm audit:bundle && pnpm test:e2e && pnpm audit:openapi && pnpm audit:a11y && pnpm audit:perf && pnpm audit:dupes


> executiveos@0.1.0 lint /workspace
> eslint . --max-warnings=0


/workspace/src/core/db/jobs-repo.ts
  42:8   error  Async function 'claim' has too many lines (71). Maximum allowed is 60  max-lines-per-function
  43:27  error  Async arrow function has too many lines (69). Maximum allowed is 60    max-lines-per-function

/workspace/src/core/jobs/runner.ts
  9:8  error  Function 'startRunner' has too many lines (61). Maximum allowed is 60  max-lines-per-function

/workspace/src/modules/people/ui/PersonForm.tsx
  29:8  error  Function 'PersonForm' has too many lines (99). Maximum allowed is 60  max-lines-per-function

/workspace/src/modules/users/ui/AdminDataPage.tsx
  21:8  error  Function 'AdminDataPage' has too many lines (93). Maximum allowed is 60  max-lines-per-function
  21:8  error  Function 'AdminDataPage' has a complexity of 15. Maximum allowed is 12   complexity

/workspace/src/modules/users/ui/UsersPage.tsx
  92:8  error  Function 'UsersPage' has too many lines (61). Maximum allowed is 60  max-lines-per-function

/workspace/src/ui/layout/AppShell.tsx
  29:7  warning  Do not use `location.assign()` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead. See: https://nextjs.org/docs/messages/no-location-assign-relative-destination  @next/next/no-location-assign-relative-destination

/workspace/src/ui/layout/AuthForm.tsx
  29:8  error  Function 'AuthForm' has too many lines (127). Maximum allowed is 60  max-lines-per-function
  29:8  error  Function 'AuthForm' has a complexity of 15. Maximum allowed is 12    complexity

✖ 10 problems (9 errors, 1 warning)

 ELIFECYCLE  Command failed with exit code 1.
 ELIFECYCLE  Command failed with exit code 1.
```
