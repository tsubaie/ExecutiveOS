# AI models, task breakdown, and note assistance

**Current verification/publication:** see [GitHub publication](github-publication.md). The maintainer has resumed tests and audits; pause statements below describe the earlier development history.

Status: development in progress; verification and deployment paused by the maintainer

## Plan

1. Add ADMIN-B25 model catalog and default/fast model selection with structured-output admission.
2. Add a shared structured provider, durable job payload snapshots, usage records, budget/rate admission, and safe retry classification.
3. Implement TASKS-B13/A06: eligible task breakdown, review selection, stale checks and repeat-apply protection.
4. Implement NOTES-B17: note refinement and tag suggestions, persisted review, explicit atomic apply/discard, stale checks.
5. Add bilingual controls and disclosures; reuse existing jobs runner, task/note services, markdown renderer and query hooks.
6. Add requirement-named provider, service, authorization and UI tests before each implementation slice.
7. Update specs, add an ADR for model-specific capability policy, migrate disposable databases, run full audits, rebuild the local app.

## Authorization

The maintainer asked to prepare model selection and everything needed to use OpenRouter in tasks and notes. This includes their specified AI actions and underlying jobs/settings/provider/storage changes. No new external services or dependencies are needed. Real user content is never submitted as part of automated tests.

## Current development

Model selection, task breakdown, note refinement, tag suggestions, durable execution and explicit review/apply flows have been added. Admin controls include capability switches, a monthly token budget and usage estimates. These additions are not yet verified or deployed.

## Maintainer sequencing instruction

Finish development first. Do not run tests, audits, builds, migrations or deployment until the maintainer explicitly requests that phase. The existing server remains on the previous saved-key implementation. Earlier test results do not verify the current expanded implementation.

## Deferred verification and delivery

Complete requirement coverage for admission limits, job retries and publication fences, authorization, bilingual review flows, and adversarial fixtures. Update generated OpenAPI after route development. Once authorized, run targeted checks and the full `pnpm audit:all` gate against isolated databases, then apply migrations and rebuild the local app when deployment is requested. Preserve the user's saved credential and existing screenshot edits.

## Local preview follow-up

The maintainer subsequently authorized rebuilding and restarting localhost, with tests and audits still paused. Diagnosing the reported `ai_unavailable` catalog error showed that the SDK's default `anthropic-version` header selects a different, paginated catalog containing `display_name` instead of the native model metadata. Omit that header only on model catalog reads; keep message generation transport unchanged. Added a request-argument regression assertion without running the test suite.

A later validation report exposed an additional catalog/settings mismatch: native `~` aliases were displayed but rejected by the settings registry. Model selection and settings now share the same ID schema, accepting namespaced aliases and filtering unsupported syntax before display. Regression coverage was updated without execution. The user's precise failing action is still pending clarification; do not equate this identified defect with confirmation of the reported request's cause.

## Mission Control reference

The maintainer requested the local MissionControl project's note AI flow. Read its `docs/note-refine.md`, `components/notes/RefineReview.tsx`, `components/notes/NoteDetail.tsx`, and `lib/note-refine/prompts.ts` as references. Adapted review tabs, original comparison, editable selected task titles, selected tags, note-only and note-plus-tasks application, reopen/back behavior and prompt structure under NOTES-B18. Retained ExecutiveOS's OpenRouter transport, durable in-process jobs, sanitizing markdown and transactional revision checks. No CLI, external worker, Notion or threading dependency was introduced. Prompt v2 is snapshotted for new refinement jobs; v1 remains for existing jobs. Tests/audits remain paused; previous localhost rebuild authorization remains in effect.

Added named NOTES-B18 service scenarios for edited task titles with repeat-apply protection and note-only application without task creation. They have not been run. Bilingual browser review, keyboard/focus behavior and full provider generation remain pending authorized verification.

## Generation failure diagnosis

Read-only metadata showed recent note/tag jobs failed with generic provider errors. A read-only OpenRouter credits request confirmed exhausted account credits while key authentication remained valid. Generation HTTP 402 now maps to a localized billing message; other API failures retain only a safe HTTP status. No generation was replayed and no saved key or note content was printed. The separate optional original-content job field is omitted entirely for non-refinement jobs so JSON response validation does not reject undefined values. Tests and audits remain paused.

## Missing actions in the screenshot

The latest Pictures screenshot showed an old failed tag job without any retry button, and no Refine action. Read-only diagnostics confirmed jobs enabled, all capability switches enabled, both saved models present in the catalog and successful key authentication. Availability depended on instrumentation-initialized module memory, which route bundles need not share. Availability now initializes/rechecks its own connection status on demand (60-second freshness), and unavailable UI explains setup with a read-only refresh action. Failed available jobs label the action Retry. No generation or tests were run as part of diagnosis.

## Model-specific routing errors

Subsequent user-created attempts succeeded for refinement with the selected DeepSeek V4 Pro model, while tag requests using DeepSeek Chat and later refinement using GLM Flash failed with HTTP 404. These later failures are not evidence of a credit issue. Generation now classifies 404 as model_unavailable and displays an explicit model-routing message in both note refinement and shared proposal UI. Catalog inclusion alone cannot certify routing under account provider preferences. No model settings were silently changed and no live generation was initiated by the agent.

## Account-aware model eligibility and search

ADMIN-B27 replaces the public catalog with the documented account-filtered `/models/user` endpoint, with bounded pagination and credential-scoped caching. Local support/context checks and recent routing-failure exclusion are shared by display and admission. Each model slot gains name/ID/provider search, provider filtering, counts, empty/clear states, preservation of current selection and an explicit unavailable-saved-model message. Catalog refresh does not generate content. Named model regression coverage updated but not executed; full browser coverage remains deferred.

## Visible AI progress

Added immediate button spinner/busy state and prominent submission/queue/running feedback with elapsed time, reduced-motion support and live announcements. Retries suppress previous failure text while pending. Starting a job refreshes only that job query rather than invalidating note/task pages. Added bilingual progress component scenarios without running them. Local preview rebuild remains authorized; tests and audits remain paused.

## Slow tag generation

User-created tag requests with Gemini previously completed in 3.4 and 5.8 seconds; a later request remained running. SDK configuration alone did not explicitly bound stream completion. Added an abort deadline covering the entire provider stream: 45 seconds for tags, five minutes for other capabilities. Timeout is terminal with manual retry, distinct from retried transient network errors. New tag jobs snapshot a 1024-token output cap. No new generation request or automated tests were run during this diagnosis.

## Settings menu closing immediately

Replaced native model/provider selects with the existing shared searchable ChoiceSelect. Disabled automatic model-catalog focus/reconnect refresh and polling, plus connection polling/focus refresh on the AI page. Explicit model refresh and save invalidations remain. The observed closing behavior has not been browser-tested because the maintainer's testing pause remains in force.

## Hourly-limit screenshot

Read-only admission metadata confirmed exactly 30 refinement jobs in the rolling hour, matching the configured per-user capability limit. Preserved that limit and added retry-delay metadata plus localized hourly/budget/context errors. Current submission errors suppress older generation-failure banners. Failed attempts still count, as documented; no quota was reset and no user job was replayed.

## Maintainer-requested development override

The maintainer requested disabling the hourly request cap now and revisiting it later. Added `AI_RATE_LIMIT_ENABLED` (default true) and set it to false only in the existing local environment configuration. Local rebuild/restart activates the override; attempt history is retained. Tests/audits remain paused.

## Cancel AI requests

Added a session-guarded AI cancellation endpoint, creator/admin authorization, idempotent terminal handling, immediate queued cancellation and durable running cancellation. Runner polls cancellation flags for active jobs once per tick and aborts matching controllers; existing lease/publication fences remain authoritative. UI supports cancel intent during submission, Cancelling feedback, error retry and terminal confirmation across note refinement, tags and breakdown. Cancellation does not refund upstream work already performed. Tests/audits remain paused.

Selected suggested-tag controls now use a clear accent highlight, border/ring and checkmark, with neutral unselected controls. The shared component applies this to both note refinement and tag suggestions. Visual tests remain paused.

Elapsed-time refresh fix: expose job createdAt and use it in shared AI progress for notes and tasks; submission uses the mutation timestamp. Added NOTES-B18 remount/queue-transition regression scenario, not run. Tests and audits remain paused at user request.

Arabic improvement label updated. NOTES-B13 tag editor disables browser history, refreshes current usage on focus, and excludes unused/already-selected options. Existing server query already excludes deleted notes. Added UI and last-use-removal scenarios; tests/audits remain paused.

Added NOTES-B21 / ADMIN-B28 settings tag management: atomic admin-only merge/delete across active, archived and trashed notes, revision/audit updates and AI draft invalidation, searchable inventory and explicit confirmation. Assumption: include trash to prevent removed names reappearing on restore; clearly disclosed in the UI. Latest screenshot search overlap: replaced the absolute icon with a separate flex item in the shared search control (EP-B22). Tests and audits remain paused.

Search follow-up: user clarified the overlap was the Clear filters label, not the icon. Title controls now wrap; Clear filters resets the search component and its debounce, and external query changes permanently rebase the draft. Added EP-B15 unit scenarios and EP-B22 geometry/clear browser scenarios; not executed because tests and audits remain paused.

Shared entity UX refinement: confirmed Tasks and Notes already use EntityPage/EntitySearch, with different domain search fields and module defaults. Replaced awkward toolbar wrapping with consistent two-row layout, relocated persistent Clear filters beside search, protected newer typing against delayed URL updates and active searches against module-default changes. Expanded shared browser scenarios to both modules/en/ar; not run. User clarification about the observed behavioral difference remains optional and pending.

User approved trying the proposed notes list redesign: two-line rows, muted metadata, two neutral tags plus overflow, aligned date/participant/task column, light group headings, compact weekly shortcut, and inactive Clear filters hidden with reserved space. Uses existing EntityPage navigation/search and adds presentation hooks for groups and compact featured views. Updated row scenarios without running tests; localhost rebuild only.

User rejected the table-like notes layout and requested horizontal cards. Notes now opt into the shared card presentation: spaced rounded surfaces, note icon/type/title/tags grouped together, flexible date/participant/task area with a mobile footer, existing entity navigation and selection retained. No production data changes; tests/audits remain paused.

User requested matching task cards. Tasks now opt into the same EntityPage card container as Notes, with status/priority/title/subtasks grouped inside and due date/owner in a responsive trailing area. Shared card group headings replace the note-only callback. Completion and selection remain independent controls, and absent trailing content adds no footer. Added a task card/completion browser scenario without executing tests. Tests and audits remain paused.

User approved Mission Control-inspired compact refinement for both lists. Assumption: hide note tags from cards to prioritize density; retained tags in details/filters. Compact title-first cards now group metadata at the trailing edge, use a small note dot/independent task checkbox, show semantic note task progress, and avoid the previous large icon and stacked card sections. Create moves to desktop rail, sorting is visible beside search, and task stats are unboxed. No fabricated note status counters. Updated row scenarios; testing/audits remain paused.

Screenshot follow-up: restored rounded bordered summary cards and added Inbox first in the task summary strip, preserving rail order through optional featuredOrder. Responsive grid accommodates five cards. Updated existing task browser scenario; tests/audits remain paused.
