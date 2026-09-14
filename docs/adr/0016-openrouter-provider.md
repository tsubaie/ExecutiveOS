# ADR 0016 — OpenRouter with encrypted in-app credentials

**Status:** accepted (2026-09-10)

## Context

The maintainer requested OpenRouter APIs, in-app key storage, and then explicitly removed direct Anthropic support. The current implementation has connection checks but no feature capability jobs.

## Decision

- Supersede ADR 0003's provider decision: OpenRouter is the only provider, with namespaced models from multiple vendors. The remaining job and review contracts remain in force.
- Keep `@anthropic-ai/sdk` in process per ADR 0008. Use OpenRouter's Anthropic-compatible endpoint at `https://openrouter.ai/api` with bearer authentication. No new SDK or subprocess.
- Save one OpenRouter key in the admin UI; store only a versioned AES-256-GCM envelope in a dedicated singleton `ai_credentials` table, outside the settings registry. Derive a separate encryption key from `SESSION_SECRET` with HKDF-SHA256, random 96-bit nonces, and provider-bound associated data. Changing the session secret requires re-entering API credentials.
- Saved credentials override `OPENROUTER_API_KEY` without restart. Removing the saved key restores that environment fallback. Direct Anthropic keys and provider selection are not supported.
- Reads return only credential source and provider. Writes never echo plaintext or ciphertext; audits record operation and provider only. General exports exclude credentials; database backups retain encrypted credentials and need the original session secret separately.
- Authenticate via `GET /api/v1/key`, not the public model catalog. Reject invalid response shapes and exhausted key credit limits. Use ten-second checks and no SDK retries.
- The UI prominently distinguishes a saved key, an untested connection, a failed connection, and a verified connection. Saving announces success, clears the input, and exposes a replacement action. The saved-key indicator persists after reload.
- Model settings require namespaced IDs. Defaults retain the existing configured model family with OpenRouter prefixes; syntax does not certify availability or capability support.

## Consequences

Operators can configure OpenRouter entirely in the app. Existing saved OpenRouter credentials from this development session remain compatible. Encryption protects a database-only disclosure, not a server compromise. Losing or changing `SESSION_SECRET` requires key re-entry; preserve it separately for backup restoration. Authentication success does not prove model availability or sufficient generation credits. Generation jobs, structured-output admission, pricing, and usage accounting remain planned. OpenRouter forwards future requests to downstream providers, disclosed in admin guidance.

## Alternatives considered

- Direct Anthropic alongside OpenRouter: explicitly rejected by the maintainer.
- Plaintext settings: rejected because the registry is not a secret store.
- An additional operator-managed encryption key: adds setup friction; domain-separated derivation uses the existing server secret.
- Another provider SDK: unnecessary while OpenRouter supports the existing SDK.

## References

- [Anthropic SDK compatibility](https://openrouter.ai/docs/guides/routing/model-fallbacks)
- [Authenticated key status and credit limits](https://openrouter.ai/docs/api_reference/limits)
