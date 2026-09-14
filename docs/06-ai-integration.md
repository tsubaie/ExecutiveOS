# 06 — AI integration

> Model settings accept OpenRouter `provider/model` IDs (including variants). Syntax validation does not establish availability or feature compatibility.

AI runs inside the application using the official Anthropic TypeScript SDK. OpenRouter is the only provider, using `OPENROUTER_API_KEY` as an environment fallback, per ADR 0016 and ADMIN-B23. Saved admin credentials (ADMIN-B24) override environment configuration without a restart. Only the selected key is used; a missing key disables AI. Keys are encrypted in a dedicated table; changing `SESSION_SECRET` requires re-entry. There is no worker service or CLI. All model calls must run as jobs (ADR 0010).

**Development status:** saved credentials and connection checks were previously delivered. Model selection, task breakdown, note refinement, tag suggestions, controls and usage accounting are now in development and await verification and deployment. ADR 0017 governs their execution; the remaining meeting and initiative capabilities below remain planned.

## Layers

- `core/ai/credentials.ts`, `secret.ts`, `sdk.ts`: encrypted credential resolution and SDK construction.
- `core/ai/models.ts`: compatible OpenRouter catalog and persisted model selection.
- `core/ai/admission.ts`, `controls.ts`: availability, model/context limits, reservations, rate limits and admin settings.
- `core/ai/provider.ts`, `execute.ts`, `usage.ts`: structured streaming, safe failures and invocation accounting.
- `core/ai/review.ts`: authorized, repeat-safe proposal application.
- `modules/<m>/ai/`, `jobs.ts`: versioned prompts, domain normalization, review services and fenced publication.
- `ui/ai/`: shared polling and progress/review states. Current-user jobs are read through `/ai/job` with entity and capability filters.

## Model policy and setup

Save an OpenRouter key on `/admin/ai`, test the connection, then explicitly select a default model for task breakdown/note refinement and a fast model for tag suggestions. Only text models advertising structured outputs appear. The catalog is cached for one minute; admission rechecks model presence and context/output limits. Existing default strings are configuration placeholders, not certified model availability. Select the desired capabilities and optionally set a monthly token budget. Generation also requires the in-process jobs runner to be enabled.

## Connection check

On boot and on Test connection, the SDK calls authenticated `/v1/key` through `https://openrouter.ai/api` with bearer authentication, a ten-second timeout and no retries. The public catalog is not a credential check. Invalid response shapes fail closed; exhausted key limits map to billing errors. Saving a key resets connection status and takes effect without restart; environment changes require restart. A saved key indicator is separate from verified connection status. Admin guidance discloses that OpenRouter forwards requests to downstream providers.

## Task and note execution

All generation runs as durable jobs. Admission snapshots inputs, revision, content hash, locale, capability/prompt versions, model limits and catalog pricing. Calls stream with an abort signal, required structured output and parameter-compatible routing; no tools, adaptive thinking, explicit caching or model fallback is requested. Zod and domain checks validate proposals. Each job allows two attempts, retrying only network, rate-limit and invalid-output failures. Refusal/authentication failures are terminal; Retry-After delays are honored.

The admin disclosure lists the task/note content, existing tags and assignable people names included in these requests. Emails are excluded. Data framing escapes delimiter characters, and prompts treat embedded instructions as untrusted source material. Apply is an explicit, transactional, revision-fenced action; generated content never replaces entity data automatically.

## Planned document input

`meetings.brief` sends PDFs as `document` content blocks (base64). Limits enforced before the call: binary ≤ `MAX_UPLOAD_MB` (default 20, which is under the 32 MB request limit after base64 expansion), ≤ 300 pages, and a `count_tokens` preflight ≤ 150 000 tokens. Over any limit the job fails with a message asking the user to split the document; nothing is truncated silently. DOCX, MD, and TXT send extracted text framed in `<document>` tags. The text path is labeled in the brief ("analyzed from extracted text").

## Prompt construction and safety

- Prompts live in `modules/<m>/ai/prompts/<name>.v<N>.ts`. A material change bumps the version, adds fixtures, and keeps the old file until no job or stored result references it (the version is in every payload and result).
- User content is data: framed in tags with an instruction that instructions inside the content are to be ignored and, for briefs, reported under `critical_review` as a finding. No tools are attached to any capability.
- Outputs are validated by Zod (schema) and then by domain rules (owner names must match assignable people or be null, dates parse, page references within the document's page count, tag caps). Invalid domain values are dropped and counted in `result.warnings`.
- AI never writes to entity tables. It writes review rows (`note_refinements`, `meeting_briefs`, `prep_learnings` proposals) or returns drafts. Applying is a separate, idempotent, user-initiated request that checks the source entity's revision (stale → 409 with a compare view).
- Rendered AI markdown goes through the sanitizing renderer with remote images disabled and `http(s)` links only; learnings and briefs are untrusted content.
- Indirect injection is a tested threat: fixtures include a document that tries to change the recommendation and to name a fake owner; tests assert the finding appears under `critical_review` and the owner is dropped.

## Capability scope (task/note development; others planned)

| Name | Model | dedup_key | Input → output |
|---|---|---|---|
| `notes.refine` | default | `notes.refine:<noteId>` | note + context → `NoteRefineOutput` (`features/notes.md`) |
| `notes.suggest_tags` | fast | `notes.suggest_tags:<noteId>` | content, existing tags → `{ tags }` |
| `tasks.breakdown` | default | `tasks.breakdown:<taskId>` | task → `{ subtasks[] }` |
| `initiatives.update_draft` | default | `initiatives.draft:<id>` | initiative context → `{ health, body }` |
| `meetings.brief` | default, effort high, 32 000 output | `meetings.brief:<docId>:<locale>` | document + context + active learnings → `BriefSections` |
| `meetings.brief_translate` | fast | `meetings.translate:<briefId>:<locale>` | `BriefSections` → `BriefSections` |
| `meetings.learnings_proposal` | fast | `meetings.learnings:<feedbackId>` | active learnings + feedback + brief summary → `{ content }` proposal |

## Language

Output follows the language of the input content unless `targetLocale` is given. For note refinement prompt v2, mixed Arabic/English content refines into Arabic per NOTES-B18; task titles keep the source passage language. Other capabilities preserve each part’s language. Arabic output is checked for leading bidi control characters.

## Cost and admission

Task/note admission reserves two attempts using framed UTF-8 input bytes plus 8192 tokens of schema/prompt allowance and the capped output limit. Monthly usage and active reservations count against the configured budget in workspace timezone months. This conservative policy can reject inputs a tokenizer would admit. The enqueue advisory lock serializes admission. Per-user hourly limits are 30 for refinement/breakdown and 60 for tags.

Every attempt records usage and estimated cost using the snapshotted catalog prices. Unknown failed-response usage retains an estimated per-attempt reservation. Active jobs retain their reservation until termination, including while an invocation has been recorded, so admission can temporarily count extra consumption. The admin page shows usage, reservations, an 80-percent warning and thirty-day per-capability estimates. Estimates do not apply provider cache discounts and are not an invoice.

## Verification contract (execution paused by maintainer)

- Unit tests use `FakeProvider` with fixtures `tests/fixtures/ai/<capability>.v<N>.<case>.json`, recorded once with `pnpm ai:record` and reviewed like code.
- Contract tests: every fixture validates against the current output schema.
- Behavioral tests capture the request the fake provider received and assert on it (learnings included, private notes absent, document block present).
- Evaluation set: `tests/eval/` holds five documents and five notes with expected properties (facts preserved, no invented decisions, owner attribution, page references within range, Arabic fidelity). `pnpm ai:eval` runs live and reports pass rates; it is a manual gate for prompt changes, not CI.
- Nightly live smoke runs each capability once against seed data and asserts schema validity; cache hits are asserted only for capabilities whose system prompt exceeds the caching minimum for the configured model.

## Adding a capability

1. Schemas in `modules/<m>/schema/validation.ts` and the capability in `modules/<m>/ai/capabilities.ts`.
2. Prompt file `v1`, fixtures for `en` and `ar`, one adversarial fixture.
3. Register; add the setting toggle; add the job kind with concurrency and rate limit.
4. Service entry point, route, UI trigger, review or apply surface.
5. Tests: fixture, contract, request-capture, apply idempotency, disabled state.
6. Update the feature spec, this table, and the disclosure list.
