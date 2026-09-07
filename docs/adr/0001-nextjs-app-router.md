# ADR 0001 — Next.js App Router with TypeScript as the single deployable

**Status:** accepted (2026-09-07)

## Context

The predecessor (Mission Control) was a Next.js app and its best ideas (entity page framework, hooks, mobile patterns) are TypeScript/React. The product must be self-hostable by others as one container, be built mostly by AI agents, and serve both a rich client UI and an HTTP API for the same data.

## Decision

Use Next.js (App Router, React 19) with TypeScript strict as the only application process. Server components and route handlers share the module service layer. The job runner lives in the same process, started from `instrumentation.ts`.

## Consequences

- One codebase, one image, one language for agents.
- Route handlers must stay thin; all logic lives in modules so it is testable without HTTP.
- Multi-instance deployments must keep the job runner safe (atomic claims); this is designed in from the start.
- Next.js major upgrades are a maintenance cost; pin and upgrade deliberately.

## Alternatives considered

- **Rust (Axum) backend + SPA**: maximal performance and the maintainer likes Rust, but zero reuse of prior UI work, two languages for agents, and slower UI iteration.
- **SvelteKit / Remix**: fine frameworks, but smaller agent familiarity and shadcn ecosystem fit is weaker.
- **Separate API service + Next.js frontend**: clean separation, but two deployables contradicts the one-container goal.
