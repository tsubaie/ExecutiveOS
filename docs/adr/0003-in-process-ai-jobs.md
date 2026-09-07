# ADR 0003 — In-process AI via the Claude API and a Postgres-backed job runner

**Status:** accepted (2026-09-07); execution contract extended by ADR 0010 (inline mode removed)

## Context

The predecessor ran AI through a separate worker service (first TypeScript, then Rust) that spawned a locally installed Claude CLI, communicated over HTTP with a shared secret, and maintained three separate job tables. This made self-hosting hard (two services, a CLI dependency, host-only binaries), made the security boundary fuzzy, and duplicated queue logic. The maintainer's requirement for the rewrite: no separate worker, no CLI, AI must work from inside the application using APIs.

## Decision

- All model calls use `@anthropic-ai/sdk` from within the Next.js server process, behind a small `AiProvider` interface with one implementation (Anthropic) in v1.
- Capabilities declare Zod input and output schemas; outputs use structured outputs (`output_config.format`) and are validated again before persistence.
- Long-running capabilities run through a job runner backed by a single `jobs` table, claimed with `FOR UPDATE SKIP LOCKED`, started from `instrumentation.ts`. Short capabilities run inline with a 60 s ceiling.
- AI never writes to entity tables; it writes to review tables or returns drafts. Users apply results explicitly.
- If no API key is configured, AI features are absent from the UI and API, and everything else works.

## Consequences

- One deployable; self-hosters need only an API key to enable AI.
- Model calls consume the app's event loop and memory for streaming; concurrency is capped (`JOBS_CONCURRENCY`) and calls are streamed for large outputs.
- Provider lock-in is limited to `core/ai/anthropic.ts`; a second provider is a later ADR.
- Prompt injection is mitigated structurally: content-processing capabilities get no tools, outputs are schema-bound, and nothing is auto-applied.
- Cost visibility requires the `ai_invocations` log and the admin usage page, which are therefore v1 scope.

## Alternatives considered

- **Keep the Rust worker**: robust, but contradicts the one-process requirement and keeps the CLI dependency.
- **Claude Agent SDK or CLI subprocess**: the predecessor's approach; rejected for portability and security.
- **Managed Agents**: server-managed sessions are more than these capabilities need; single structured calls suffice.
- **Redis/BullMQ queue**: adds an infrastructure dependency for self-hosters; Postgres `SKIP LOCKED` is sufficient at this scale.
