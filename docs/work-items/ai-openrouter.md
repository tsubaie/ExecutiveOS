# OpenRouter with in-app key storage

**Current verification/publication:** see [GitHub publication](github-publication.md). The account below records the initial credential-only slice; later model, generation and UI work is included in the publication work item.

Status: verification in progress

## Plan

1. Rebase `feat/ai-openrouter` onto current `origin/main`, preserving existing screenshots.
2. Add ADMIN-B23 connection and model-setting scenarios.
3. Add ADMIN-B24 encrypted credential persistence and authorization scenarios.
4. Build the admin save/replace/remove form with English and Arabic status feedback.
5. Record ADR 0016, migration 0006, and updated operator documentation.
6. Run `pnpm audit:all`, browser scenarios, and start the local app for maintainer testing.

## Summary

OpenRouter is the only provider. Administrators save, replace, and remove their key in the app without a restart. A prominent saved-key indicator persists after reload, success is announced, and the password input clears after saving. Connection status separately distinguishes untested, failed, and verified credentials. Saved secrets use authenticated encryption and never appear in API reads or audit diffs.

## Requirement → scenario

| ID | Test file | Scenario |
|---|---|---|
| ADMIN-B23 | `src/core/ai/tests/client.test.ts` | OpenRouter bearer authentication, no fallback to a legacy Anthropic key, safe errors, malformed/exhausted key responses, model ID syntax |
| ADMIN-B24 | `src/core/ai/tests/credentials.test.ts` | Encrypted persistence, replacement, removal, safe metadata/audits, authenticated encryption and redaction |
| ADMIN-B24 | `src/core/ai/tests/credentials-api.test.ts` | Member denial, cross-origin denial, admin writes/reads without credential disclosure |
| ADMIN-B24 | `e2e/ai.spec.ts` | Save/reload/replace/remove and error feedback in both locales at desktop and 390px; credential HTTP calls intercepted to avoid touching real keys |

## Files changed

- Core AI/config: OpenRouter SDK construction, authenticated checks, encryption, model validation and environment fallback.
- Core DB/HTTP: singleton credential storage and admin-only credential endpoints.
- Users UI: saved-key form, status feedback, connection state distinction; both translation catalogs.
- Documentation/API: provider ADR, feature/data/architecture specs, setup instructions, OpenAPI.

## Migrations

`drizzle/0006_ai_credentials.sql` adds a singleton credential table with provider and singleton constraints. Schema audit verified empty-database application; application startup applied it to the existing local database. No existing data is deleted. The migration-concurrency test now expects seven migration entries. Generated Drizzle snapshots account for most of the diff volume.

## Audits

Pending final `pnpm audit:all` result. Targeted provider/credential/API and migration suites: 16 tests passed. No new dependencies.

## Assumptions and authorization

1. The maintainer explicitly requested OpenRouter, in-app key persistence, running the server, and then OpenRouter-only behavior with improved saved-key feedback.
2. Saved credentials override `OPENROUTER_API_KEY`; removing a saved key restores that fallback (ADMIN-B23/24).
3. Encryption derives a domain-separated key from the existing `SESSION_SECRET`, avoiding extra setup. Changing the secret requires API key re-entry; documented in ADR 0016 and README.

## Scope and limitations

AI feature jobs, generation UI, capability admission, and usage accounting remain planned under their feature specifications. A valid connection is not a claim that every model or generation capability is available. No live generation or prompt changes were made. General export is still planned and must exclude credentials. No remote branches, pushes, or PRs were created. Eight pre-existing task screenshots were preserved and are excluded from this work.
