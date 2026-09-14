# ADR 0018 — Configurable AI hourly admission limits

**Status:** accepted (2026-09-10)

## Context

Repeated manual development attempts reached the hourly AI admission cap. The maintainer explicitly requested disabling this limit during development and revisiting it later.

## Decision

Extend ADR 0017 with an environment-controlled override: `AI_RATE_LIMIT_ENABLED` defaults to `true`; an explicit `false` bypasses only the app's per-user hourly AI request cap. The current local development environment sets it to false. Retain attempt history, token accounting, optional workspace budget, job concurrency, timeouts and upstream provider limits.

## Consequences

Manual development can continue without waiting for the hourly window. Re-enabling the flag and restarting restores admission limits using existing history. The override does not change provider billing or rate limits.

## Alternatives considered

Deleting job history or resetting counters would erase diagnostic information. Removing the limiter entirely would make later re-enablement harder. Neither is needed.
