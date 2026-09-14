# GitHub publication — OpenRouter, shared entities and committees

The maintainer authorized tests, builds and publishing to GitHub after the development pause.
Scope: the accumulated OpenRouter integration, note/tag AI review, shared Tasks/Notes card and
search UX, tag administration, and committee/task/note integration on `feat/ai-openrouter`.
Publishing means committing this branch, pushing to origin, and opening a reviewable pull request.
The maintainer subsequently authorized merging to main as soon as verification completes.
No production deployment is included.

Validation uses a disposable PostgreSQL server and a separate browser workspace. Live localhost
records and its API credential are excluded from the test environment and from publication.

Development findings resolved during validation:
- Committee read schemas strip internal database/cursor fields; create/patch remain strict.
- Correlated committee task/note queries explicitly qualify the outer committee ID.
- AI controls have smaller shared status/start/cancel components; search submission state no longer
  reads a mutable ref during render.
- Cross-module orchestration follows public module APIs without cycles; schemas and service files
  follow the module manifest.
- Structural audit recognizes manifest-based job registration; duplicate audit includes unstaged
  and untracked source changes as well as committed changes.
- Detail panels and task creation load on demand to meet the route JavaScript budget.
- Choice fields keep their submitted value while the searchable picker loads; a committee
  assignment can no longer disappear when creating linked work with more than ten choices.
- Shared card group counts retain the muted text token at full opacity to meet text contrast
  requirements in dark mode; the populated committee page exposed the previous failure.

Requirement coverage remains recorded in the feature work items and named scenarios. Complete
validation results and GitHub references are recorded below once the gate finishes.

## Requirement → scenario

| Requirement | Test file | Scenario |
|---|---|---|
| ADMIN-B24 | `e2e/ai.spec.ts` | Save, reload, replace and remove an API key, en/ar |
| ADMIN-B24 | `src/core/ai/tests/credentials-api.test.ts` | Members cannot read/save/remove credentials; cross-origin writes fail |
| ADMIN-B25, B27 | `src/core/ai/tests/models.test.ts` | Compatible model filtering, unavailable model rejection and routing-failure exclusion |
| TASKS-B13, A06 | `src/modules/tasks/tests/ai.test.ts` | Apply selected subtasks once and refuse stale drafts |
| NOTES-B17, B18 | `src/modules/notes/tests/ai.test.ts` | Atomic review application, stale rejection, edited titles and note-only application |
| NOTES-B19 | `src/core/ai/tests/cancel.test.ts` | Creator authorization, repeated cancellation and finished-job preservation |
| NOTES-B18 | `src/modules/notes/tests/ui/ai-progress.test.tsx` | Immediate progress, Arabic queue/running states and elapsed time after remount |
| NOTES-B21, ADMIN-B28 | `src/modules/notes/tests/service.test.ts` | Merge/delete across active, archived and trashed notes; member administration rejected |
| EP-B15, B22 | `src/ui/entity/tests/search.test.tsx`, `e2e/entity-search.spec.ts` | Reset cancels pending search; delayed URL updates preserve typing; clear controls do not overlap |
| COMM-A01, A04 | `e2e/committees.spec.ts` | Shared committee create and linked task workflow, en/ar |
| COMM-A01 | `src/ui/layout/tests/choice-select.test.tsx` | Selected form value survives lazy searchable-picker loading and is submitted exactly once |

Additional module requirement mappings remain in the feature work items and named service/UI tests.
