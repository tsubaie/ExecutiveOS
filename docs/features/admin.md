# Feature: Admin

**Status:** accepted
**Spec reviewed:** 2026-09-07
**Implementation verified:** not yet
**Owner modules:** `src/modules/users`, `src/modules/settings`, admin pages under `src/app/(app)/admin`

## Purpose

Everything an administrator needs to run the installation from the browser: setup, users, settings, AI, learnings, backups, jobs, audit log, export. No CLI is required for any admin task; the operator only edits environment variables and restarts for secrets.

## Setup and recovery

- ADMIN-B01 First boot prints `SETUP_TOKEN` (random, 32 bytes) to the log; `/setup` requires it, creates the admin, the principal person (linked to the admin unless "the principal is someone else" is chosen), workspace name, default locale, timezone; runs in a transaction locking `workspace`; a second submission after completion → 409.
- ADMIN-B02 `/recovery` exists only when `RECOVERY_TOKEN` is set; accepts the token once, lets the operator set a new password for a chosen admin, then records the token hash as used (a restart with the same token is refused).

## Users

- ADMIN-B03 List, invite (create with a temporary password shown once), edit name and role, deactivate/reactivate, reset password (temporary, shown once), view sessions and revoke. Deactivation and password reset revoke all sessions of that user.
- ADMIN-B04 Last-admin protection: demoting or deactivating the last active admin → 422 `ADMIN-B04`.
- ADMIN-B05 Each member manages their own profile: name, password, locale, timezone, theme, numerals; changing password revokes other sessions.
- ADMIN-B06 Linking a user to a person (`people.user_id`) is done from the user page; one-to-one.

## Settings

- ADMIN-B07 Settings pages render from the registry: each key with its schema-driven control, default, description, and reset. Workspace keys are admin-only; user keys appear in the profile. Values validated on save; invalid → field errors.
- ADMIN-B08 Notes types editor (`notes.types`, `notes.default_type`) on `/admin/notes`: add, rename label per locale, disable (existing notes keep the identifier), choose the default (`NOTES-B20`).
- ADMIN-B09 KPI thresholds editor with validation and a preview of how many KPIs change status.

## AI

- ADMIN-B10 AI page: connection status and Test connection; model selection from the allowlist with feature matrix; capability toggles; monthly budget with usage bar; fallback toggle; disclosure list of data sent per capability; usage table (30 days by capability: calls, tokens, cache rate, estimated cost, pricing version).
- ADMIN-B11 Learnings: active version with content; proposals list with diff, source feedback, Activate, Reject, Edit-and-activate, Reset; history of versions.

- ADMIN-B23 OpenRouter is the only AI provider. Saved credentials take precedence over `OPENROUTER_API_KEY`; absent both, AI is disabled. Direct Anthropic configuration and provider selection are unavailable. Connection checks use bearer authentication against `/api/v1/key`, a ten-second timeout, and no retries; they reject malformed responses and exhausted key limits and map invalid credentials, billing, rate limits, network failures and other provider failures to safe categories. AI model settings accept namespaced OpenRouter IDs (including variants and `~` aliases), rejecting unqualified IDs, URLs and malformed IDs. Syntax does not imply capability compatibility. Both locales disclose forwarding to downstream model providers.

- ADMIN-B24 Administrators can save, replace, and remove an OpenRouter API key on `/admin/ai` without restarting. The selected saved credential overrides environment configuration; removal restores environment fallback. A password field is never prefilled, and successful save clears the submitted key and announces confirmation. A prominent persistent “Key saved securely” indicator survives reload; a saved key changes the form action to “Replace key”. Connection status is separate: untested credentials show “Connection not tested yet”, and failed tests explicitly show failure. API reads expose only provider and credential source; members cannot read or mutate credentials. Keys are stored separately from the settings registry with AES-256-GCM authenticated encryption using a domain-separated key derived from `SESSION_SECRET`; changing that secret requires re-entering the API key. Audit entries contain only operation and provider, never plaintext or encrypted keys. General exports exclude credentials; database backups retain encrypted credentials and require the original `SESSION_SECRET` to decrypt them. Invalid or unreadable stored credentials fail closed.

- ADMIN-B26 Task and note generation uses durable, revision-snapshotted jobs with required structured outputs, no tools or model fallback, and at most two provider attempts. Admission enforces enabled capability switches, model limits, a workspace monthly token budget and per-user hourly limits (30 breakdown/refinement, 60 tags). Administrators can change switches and the budget and view current-month usage/reservations plus thirty-day per-capability token/cost estimates. Generation HTTP 404 failures are terminal model-routing failures and explain model selection/provider preferences without claiming invalid credentials. Generation HTTP 402 failures are terminal billing failures and display a localized insufficient-credit/spending-limit message. Unknown failed-call usage retains conservative estimated consumption. See ADR 0017; current development awaits verification.

- ADMIN-B25 The AI page loads the OpenRouter catalog and offers default (task breakdown and note refinement) and fast (tag suggestions) model selections. Only text models advertising structured outputs appear. Catalog requests omit the SDK’s `anthropic-version` header so OpenRouter returns native model IDs, pricing and supported parameters rather than its paginated Anthropic compatibility catalog. Saving rejects models absent from this compatible catalog. Admission rechecks model support and token limits; stored IDs alone never enable a capability.

## Backups and export

- ADMIN-B12 Backups page: schedule (from `schedules`), retention (`retention.backup_count`, default 14), list of backups with size, manifest status, Create now (enqueues `system.backup`), Download (admin, streamed), Delete, Verify (checks manifest checksums).
- ADMIN-B13 Restore is a command (`pnpm backup:restore <file>`) documented on the page; it puts the app in maintenance mode, restores DB and files, verifies, and exits maintenance. Maintenance mode returns 503 for all routes except health.
- ADMIN-B14 Export `POST /admin/export` enqueues `system.export` producing a zip: `manifest.json`, one JSON file per table (excluding sessions, login_attempts, idempotency_keys, private notes of other users), markdown renders of notes and briefs, original documents that are available. The requesting admin's own private notes are included under their user id. Download when ready.

## Shell placement

- ADMIN-B19 The administration entry sits at the foot of the sidebar, above the workspace identity, not among the everyday modules; it is an occasional destination and the rail reads top-down by frequency of use. It stays absent for members (ADMIN-B03) and keeps its place in the mobile bar, where there is no top and bottom to separate.

## Deployment configuration

- ADMIN-B17 Startup refuses a production configuration whose `APP_URL` is not HTTPS, unless the URL points at a loopback host (the documented opt-out for smoke-testing a production image locally). The session cookie's `Secure` flag is derived from that validated deployment mode rather than from the raw URL string, so a deployment typo cannot silently emit a non-Secure bearer cookie.
- ADMIN-B20 The client address is resolved from `X-Forwarded-For` by walking the chain right to left and taking the first hop outside `TRUSTED_PROXY_CIDRS`; a prepended address is therefore inert. With no proxy configured, an absent header, or an all-proxy chain, the address is unknown and no per-address control applies rather than every request sharing one placeholder. Login throttling counts the email and the client address as independent buckets, five failures each per 15 minutes: neither their union nor an unknown address can lock an account or an installation that neither key reached (ADR 0013).
- ADMIN-B21 Every login path performs exactly one argon2 verification. Unknown, deleted and deactivated accounts verify a process-lifetime placeholder hash generated with identical parameters, so response time cannot distinguish a registered address from an unregistered one.
- ADMIN-B22 `/recovery` is throttled on the client address alone and records its attempts without an email, because the secret being guessed is the installation-wide `RECOVERY_TOKEN` and an email bucket would let recovery traffic lock a named administrator out of login. A configured `RECOVERY_TOKEN` must be at least 32 characters and `TRUSTED_PROXY_CIDRS` must parse, both refused at startup with an actionable message.
- ADMIN-B18 Log redaction is recursive: passwords, tokens, cookies, authorization headers, API keys, prompt bodies and private notes are censored at every nesting depth, in arrays as well as objects, and errors are serialized through an allowlist of type, message, stack and cause so a thrown `AppError`'s details never reach a durable log. The one-time `SETUP_TOKEN` line (ADMIN-B01) is deliberately printed in full; reading it requires privileged access to the container log.

## Jobs and audit

- ADMIN-B15 Jobs page: queued, running, failed in the last 7 days; details with attempts and errors; Retry (creates a new job with the same payload), Cancel; per-kind concurrency shown.
- ADMIN-B16 Audit log page: filter by actor, entity type, date; diff view; private tables never appear.

## API (all admin-guarded unless noted)

`/setup` (public while empty), `/recovery` (public when configured), `/admin/users…`, `/admin/settings…`, `/admin/ai…`, `/admin/learnings…`, `/admin/backups…`, `/admin/export`, `/admin/jobs…`, `/admin/audit`, `/auth/me`, `/auth/password` (session).

## Acceptance criteria

- ADMIN-A01 Fresh stack: setup with the printed token succeeds once; a second attempt is refused. (en, ar)
- ADMIN-A02 Deactivating the only admin is refused; adding a second admin allows it. (en)
- ADMIN-A03 A backup created from the page verifies; restoring it into a fresh stack boots the app with the same data and documents. (en)
- ADMIN-A04 Export contains every table listed and no other users' private notes. (en)
- ADMIN-A05 Changing KPI thresholds shows the preview and updates statuses. (en)
- ADMIN-A06 Recovery with the token works once; a second use is refused. (en)

## Required scenarios

- service/api: B01–B24 each; setup race; login throttling buckets; forwarded-address spoofing; last-admin; session revocation matrix; settings role allowlists; export exclusions; maintenance mode gating.
- core adversarial: backup during writes; restore drill.
- e2e `admin.spec.ts`: A01–A06.
- Mutation targets: `lastAdminGuard`, `activateLearnings`, `exportExclusions`, `clientIp`, `throttle`.

Availability initializes connection status on demand in each route runtime and refreshes it after sixty seconds, so instrumentation-only memory cannot hide configured features after a restart. Unavailable feature panels explain setup and provide a read-only availability refresh; failed available jobs show Retry.

- ADMIN-B27 **Model eligibility and filtering**: Catalog discovery uses authenticated `/v1/models/user`, paginated without following arbitrary response URLs, so account provider/privacy restrictions apply before local filtering. Offer namespaced text models with structured outputs, positive output capacity and enough context for each model slot; omit batch-only variants. Cache catalog metadata for sixty seconds per credential fingerprint. Before displaying or admitting a model, consult the latest invocation in the past hour (after saved-key replacement); a latest 404/model-routing failure temporarily excludes that model until the window expires or a later invocation succeeds. Do not change saved selections silently: show an unavailable selection and require a replacement before saving. Both selectors support case-insensitive multi-word search across model name/ID/provider, a provider filter, result count, empty state and clear action; filtering preserves the current eligible selection. Catalog eligibility is not a guarantee of future routing or input-specific context fit. Tests/audits remain pending.

ADMIN-B27 model/provider menus use the shared searchable ChoiceSelect controls. Model discovery and connection queries do not poll or refetch on window focus while editing the AI form; explicit refresh and mutation invalidation update them. This keeps open menus and in-progress selections stable.

ADMIN-B26 admission failures distinguish hourly limits (including failed jobs, with estimated retry delay from the oldest request in the rolling window), workspace budget exhaustion and input context limits. Current admission errors replace historical generation errors in the UI rather than displaying both. The hourly allowance remains 30 refinement/breakdown or 60 tag requests per user and capability.

ADMIN-B26 hourly AI admission limits are controlled by `AI_RATE_LIMIT_ENABLED` (default `true`). Setting it to `false` disables the app's per-user hourly refinement/breakdown/tag request cap for development, without deleting attempt history or changing workspace token-budget, concurrency or provider limits. Configuration is read on startup. The maintainer requested this local development override; see ADR 0018.

- ADMIN-B28 **Tag management**: `/admin/notes` includes the searchable tag-management section defined in NOTES-B21 alongside note types. Only administrators can list the complete inventory or delete/merge tag usage.
