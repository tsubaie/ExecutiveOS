# ADR 0025 — Security headers from the app, and verified TLS for remote databases

**Status:** accepted (2026-09-22)

Number 0024 is taken by the backup restore work in the pull request for #50.

## Context

Issue #57 re-verified two gaps (#10, #17). The app set no security headers at all: no CSP, HSTS, framing, referrer, permissions or `nosniff` header, although the security checklist requires a CSP and the API conventions require download headers. The database pool took TLS from whatever `DATABASE_URL` said. The backup commands defaulted `PGSSLMODE` to `prefer`, which silently falls back to plaintext. Nothing distinguished a database on the Compose network from one across the internet, and no document stated a TLS policy.

## Decision

**Headers come from the app, not the reverse proxy.** `src/proxy.ts` applies one policy (`core/http/security-headers.ts`) to every response except build assets, so a self-hoster's proxy configuration cannot drop them.

- Pages get a CSP with a per-request nonce and `'strict-dynamic'`. Next stamps the nonce on its own scripts when the CSP travels in the request, and the root layout reads it for `next-themes`' inline script. Reading it keeps every page dynamically rendered, which a per-request nonce requires. The production build confirms every page renders dynamically.
- API responses get `default-src 'none'` and `Cache-Control: no-store`. Downloads are API routes, so they inherit both along with `nosniff`.
- HSTS (one year, with subdomains) and `upgrade-insecure-requests` are sent only when `NODE_ENV` is production and `APP_URL` is HTTPS. The loopback opt-out of ADMIN-B17 therefore never pins a browser to HTTPS for localhost.

**CSP exceptions**, each deliberate. Images are limited to the app's own origin with no exception, because nothing renders data or object URLs today.

| Exception | Why |
|---|---|
| `style-src 'unsafe-inline'` | Base UI positions popups, sonner injects its stylesheet, and recharts sizes SVG through style attributes at runtime. A nonce cannot cover style attributes. Script injection, the real XSS risk, stays nonce-bound. |
| `'unsafe-eval'` in development only | React's development build reconstructs server stacks with `eval`. Production never sends it. |

**Database TLS policy.** A host is Compose-private when it is a single-label name (`db`, `executiveos-db`), a loopback address or a Unix socket. Its URL's `sslmode` applies as written, because the traffic never leaves the container network. Every other host is remote, including private IP literals, since a LAN or VPC address says nothing about who else is on the path. Startup refuses a remote URL without `sslmode=verify-full`. The pool verifies the chain and host name against `DATABASE_SSL_ROOT_CERT` or the system trust store. `pg_dump` and `pg_restore` get `PGSSLMODE=verify-full` and `PGSSLROOTCERT` set to that file or libpq 16's `system`. The remote URL's TLS parameters are stripped before they reach node-postgres, because its connection-string parser overrides an explicit `ssl` object.

## Consequences

- Every deployment gains the headers without configuring its proxy. A proxy that also sets them should match or drop its own copies.
- A new inline script, a remote asset or a new CSP exception fails in the browser until the policy changes. The e2e suite checks the login page for violations.
- A deployment whose database is on a LAN address without TLS no longer starts. It must use TLS or reach the database through a single-label host name on a private network it controls. The refusal message says so.

## Alternatives considered

- **Headers in `next.config.ts` `headers()`.** Static values cannot carry a per-request nonce, and the config file cannot read the validated environment. Rejected.
- **Hash-based CSP.** Next's inline bootstrap scripts differ per page and per build, so hashes would need to be regenerated constantly. Rejected.
- **Nonces for styles too.** Would still need `'unsafe-inline'` for attributes, and breaks sonner's injected stylesheet. Rejected until those libraries accept a nonce.
- **Treating RFC 1918 addresses as private.** Convenient for LAN setups, but it is exactly the silent downgrade #17 asked to remove. Rejected.
- **`sslmode=require` for remote hosts.** It encrypts without authenticating the server, so an active attacker still reads everything. Rejected.
