# ADR 0005 — Own multi-user auth with cookie sessions and roles

**Status:** accepted (2026-09-07)

## Context

The predecessor used a beta version of Auth.js for a single hard-coded user, stored the password hash in a general settings table readable by any session, and mutated `process.env` at runtime to rotate credentials. An open-source, multi-user product needs a simple, auditable model that self-hosters understand and that agents cannot misconfigure.

## Decision

- `users` table with argon2id password hashes (m=64 MiB, t=3, p=4), `role ∈ {admin, member}`, `is_active`.
- `sessions` table storing a SHA-256 hash of an opaque 256-bit token; cookie `eos_session` (httpOnly, Secure in production, SameSite=Lax), sliding 30-day expiry, revocable per session.
- First-run setup creates the first admin when `users` is empty; the setup route is disabled afterwards.
- Login rate limiting in Postgres (5 failures per email or IP per 15 minutes). Password change revokes other sessions.
- State-changing requests require the `X-Requested-With: ExecutiveOS` header in addition to the cookie.
- Authorization is coarse: all members read and write all module data; admins additionally manage users, settings, backups, AI. Finer permissions are a later ADR if needed.
- Credentials never live in `settings`. The settings registry rejects secret-like keys.

## Consequences

- No third-party auth dependency; ~400 lines of well-tested code.
- SSO/OIDC is not in v1; the session model leaves room to add an identity provider table later.
- Password reset requires an admin (no email in v1); documented in the admin guide.

## Alternatives considered

- **Auth.js v5**: capable, but its abstractions exceed the need and the beta history was painful.
- **Lucia**: sound design, but the library was deprecated in favor of "write it yourself" guidance, which is what this ADR does.
- **Single-user mode only**: simpler, but contradicts the shared-office use case.
