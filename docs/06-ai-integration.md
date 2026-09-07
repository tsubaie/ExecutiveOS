# 06 — AI integration

AI runs inside the application by calling the Claude API with the official TypeScript SDK. There is no worker service and no CLI. All model calls run as jobs (ADR 0010). If `ANTHROPIC_API_KEY` is not set or the connection check fails, AI entry points are hidden and AI routes return `503 ai_unavailable`; nothing else changes.

## Layers

```
modules/<m>/ai/capabilities.ts   capability definitions (schemas, model policy, prompt builder)
modules/<m>/ai/prompts/<name>.v<N>.ts
core/ai/capabilities.ts          registry: name → capability
core/ai/provider.ts              interface AiProvider { complete<T>(req, signal): Promise<AiResult<T>> }
core/ai/anthropic.ts             the only provider in v1
core/ai/fake.ts                  fixture provider for tests
core/ai/client.ts                SDK client, timeouts, connection check, model feature matrix
core/ai/budget.ts                reservations against the monthly budget, per-user rate limits
core/jobs/*                      every capability runs as kind ai.<name>
```

A capability:

```ts
export const noteRefine = defineCapability({
  name: "notes.refine",
  version: 3,
  input: NoteRefineInput,
  output: NoteRefineOutput,
  model: "default",           // "default" | "fast"
  effort: "high",
  maxOutputTokens: 16000,
  estimateInputTokens: (input) => …,   // for budget reservation
  system: SYSTEM_PROMPT,
  buildUser: (input) => ContentBlock[],
  rateLimitPerHour: 30,
});
```

`runCapability(cap, input, ctx)` validates input, snapshots everything the job needs into the payload (input, `capabilityVersion`, `promptVersion`, resolved model, locale, `learningsVersion` where applicable, entity revisions and content hashes), reserves budget, enqueues `ai.<name>` with a `dedup_key` from the spec, and returns the job id. The UI polls `GET /jobs/:id`.

## Model policy

| Setting | Default | Notes |
|---|---|---|
| `ai.model.default` | `claude-opus-5` | must be in `core/ai/models.ts` |
| `ai.model.fast` | `claude-sonnet-5` | |
| `ai.enabled_capabilities` | all | admin toggle per capability |
| `ai.monthly_token_budget` | null | soft cap in workspace timezone months |

`core/ai/models.ts` holds the allowlist with a feature matrix (structured outputs, adaptive thinking, effort levels, PDF input, fallback support, max output). A capability whose requirements the configured model does not meet fails admission with `ai_unavailable` `reason: "provider"` and a message naming the missing feature. Model IDs are exact strings; never append date suffixes.

## Connection check (BYOK contract)

On boot and when the key changes, `core/ai/client.ts` calls `client.models.list()` and stores `{ ok, checkedAt, error }` used by `/health` and the admin AI page. Errors map to actionable messages: invalid key, billing or quota, rate limit, network. The admin page has "Test connection" and "Rotate key" instructions (set the env var, restart). It also lists exactly what is sent to the provider per capability (document content, meeting title and objective, attendee names and roles, agenda titles with KPI status and initiative health, note content, existing tags, assignable people names, active learnings). Private notes and user emails are never sent.

## Call shape

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 300_000 });

const stream = client.beta.messages.stream({
  model,
  max_tokens: cap.maxOutputTokens,
  thinking: { type: "adaptive" },
  output_config: { effort: cap.effort, format: zodOutputFormat(cap.output) },
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
  system: [{ type: "text", text: cap.system, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: cap.buildUser(input) }],
}, { signal });
const response = await stream.finalMessage();
```

Rules:

- Structured outputs for every capability. Draft-style outputs use `{ text: string }`.
- Adaptive thinking; depth via `effort`. No `budget_tokens`, no prefill.
- SDK retries are disabled (`maxRetries: 0`); the job runner owns retries so an attempt is one API call and budget accounting is exact.
- Streaming always, with the job's abort signal.
- Stable system prompt first with `cache_control`; volatile content in the user turn.
- `stop_reason === "refusal"` → job fails with `ai_failed reason: "refused"`, not retried. `parsed_output` null → `invalid_output`, retried once with the same input.
- Typed errors: `RateLimitError` → retry with backoff honoring `retry-after`; `AuthenticationError` → mark AI `error`, fail without retry; `APIConnectionError` and 5xx → retry; `BadRequestError` → fail without retry and surface the message to the admin log.
- Fallback: on `claude-opus-5` the server-side fallback beta is enabled by default; `ai_invocations.effective_model` records what actually answered. Admins can disable it (`ai.fallbacks` setting).
- Every attempt writes one `ai_invocations` row including cache write tokens, capability version, requested and effective model, and estimated cost from a versioned pricing table.

## Document input

`meetings.brief` sends PDFs as `document` content blocks (base64). Limits enforced before the call: binary ≤ `MAX_UPLOAD_MB` (default 20, which is under the 32 MB request limit after base64 expansion), ≤ 300 pages, and a `count_tokens` preflight ≤ 150 000 tokens. Over any limit the job fails with a message asking the user to split the document; nothing is truncated silently. DOCX, MD, and TXT send extracted text framed in `<document>` tags. The text path is labeled in the brief ("analyzed from extracted text").

## Prompt construction and safety

- Prompts live in `modules/<m>/ai/prompts/<name>.v<N>.ts`. A material change bumps the version, adds fixtures, and keeps the old file until no job or stored result references it (the version is in every payload and result).
- User content is data: framed in tags with an instruction that instructions inside the content are to be ignored and, for briefs, reported under `critical_review` as a finding. No tools are attached to any capability.
- Outputs are validated by Zod (schema) and then by domain rules (owner names must match assignable people or be null, dates parse, page references within the document's page count, tag caps). Invalid domain values are dropped and counted in `result.warnings`.
- AI never writes to entity tables. It writes review rows (`note_refinements`, `meeting_briefs`, `prep_learnings` proposals) or returns drafts. Applying is a separate, idempotent, user-initiated request that checks the source entity's revision (stale → 409 with a compare view).
- Rendered AI markdown goes through the sanitizing renderer with remote images disabled and `http(s)` links only; learnings and briefs are untrusted content.
- Indirect injection is a tested threat: fixtures include a document that tries to change the recommendation and to name a fake owner; tests assert the finding appears under `critical_review` and the owner is dropped.

## v1 capabilities

| Name | Model | dedup_key | Input → output |
|---|---|---|---|
| `notes.refine` | default | `notes.refine:<noteId>` | note + context → `NoteRefineOutput` (`features/notes.md`) |
| `notes.suggest_tags` | fast | `notes.tags:<noteId>` | content, existing tags → `{ tags }` |
| `tasks.breakdown` | default | `tasks.breakdown:<taskId>` | task → `{ subtasks[] }` |
| `initiatives.update_draft` | default | `initiatives.draft:<id>` | initiative context → `{ health, body }` |
| `meetings.brief` | default, effort high, 32 000 output | `meetings.brief:<docId>:<locale>` | document + context + active learnings → `BriefSections` |
| `meetings.brief_translate` | fast | `meetings.translate:<briefId>:<locale>` | `BriefSections` → `BriefSections` |
| `meetings.learnings_proposal` | fast | `meetings.learnings:<feedbackId>` | active learnings + feedback + brief summary → `{ content }` proposal |

## Language

Output follows the language of the input content unless `targetLocale` is given. Mixed content keeps each part in its language. Arabic output is checked for leading bidi control characters.

## Cost and admission

- Budget reservation: before enqueueing, `core/ai/budget.ts` reserves `estimateInputTokens + maxOutputTokens` against `ai.monthly_token_budget` (month in workspace timezone); on completion the reservation is replaced by actual usage. Over budget → `ai_unavailable reason: "budget"`. A banner appears at 80 percent.
- Per-user hourly limits: briefs 10, translations 10, refine 30, breakdown 30, tags 60; proposals are system-initiated and unlimited.
- Admin AI page: calls, tokens, cache hit rate, estimated cost by capability for 30 days; pricing table version shown.

## Testing AI

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
