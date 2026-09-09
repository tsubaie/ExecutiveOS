# ADR 0013 — Trusted client addresses, independent throttling buckets, and uniform login cost (refines ADR 0005)

**Status:** accepted (2026-09-09)

## Context

ADR 0005 specified "login rate limiting in Postgres (5 failures per email or IP per 15 minutes)". The implementation read that sentence as one counter over the union of the two keys, and no client address was ever resolved: the API layer passed the literal string `local` for every request, so every row in `login_attempts` shared one address. The two effects compounded. Five failed attempts from anyone, against any account, filled a bucket that every subsequent login consulted, so any visitor could lock every administrator and member out of the installation for fifteen minutes. The union also meant three failures against an account and two from an unrelated address added up to a lockout that neither key had reached.

`TRUSTED_PROXY_CIDRS` had been part of the environment schema and the architecture document since the beginning, but nothing read it. `login_attempts` already carried separate indexes on `(email, created_at)` and `(ip, created_at)`, which records the original intent.

Two adjacent weaknesses shared the same boundary. Argon2 verification ran only after an account was found to exist and be active, so an unknown address returned measurably faster than a real one and the endpoint answered the question "is this person registered here?". And `/recovery`, which replaces an administrator's password, had no throttle of any kind and accepted a `RECOVERY_TOKEN` of any length, including one character.

## Decision

- **Client addresses are resolved at the HTTP boundary, or not at all.** `core/http/client-ip.ts` reads `X-Forwarded-For` and walks it right to left, skipping hops inside `TRUSTED_PROXY_CIDRS` and returning the first address outside it. A proxy appends the address it accepted the connection from, so that address is the furthest hop the deployment can vouch for; anything a client prepends sits to its left and is ignored. Node's `net.BlockList` does the matching, so no dependency is added.
- **An unresolvable address is null, never a placeholder.** When `TRUSTED_PROXY_CIDRS` is empty, or the header is absent, or every hop is a trusted proxy, the resolver returns null and no per-address bucket applies. A shared sentinel is what produced the installation-wide lockout; "cannot know" and "known" must not be the same value.
- **The email bucket and the address bucket are independent.** Five failures against one email, or five from one address, close that bucket for fifteen minutes. Both are counted in one statement with `count(*) filter (where …)` so the login path stays inside the six-query request budget.
- **Every login path performs exactly one Argon2 verification.** Unknown, deleted, and deactivated accounts verify a process-lifetime placeholder hash generated with identical parameters (`argon2id`, m=65536, t=3, p=4), so response time no longer separates them from a wrong password.
- **`/recovery` is throttled on the client address alone**, and its attempts are recorded without an email. The secret being guessed is the installation-wide `RECOVERY_TOKEN`, not a password: an email bucket would protect nothing, and would hand an attacker a way to lock a named administrator out of ordinary login by spamming recovery with their address.
- **A configured `RECOVERY_TOKEN` must be at least 32 characters**, validated at startup with the same floor as `SESSION_SECRET`. `TRUSTED_PROXY_CIDRS` is validated at startup too, so a typo fails the boot rather than silently disabling every address-based control.

## Consequences

- Deployments behind a reverse proxy must set `TRUSTED_PROXY_CIDRS` to get per-address throttling. Without it, per-email throttling still protects each account, and the recovery endpoint relies on the token entropy floor instead. This is a deliberate trade: an unverifiable address is worse than no address, because it is attacker-controlled.
- An existing deployment with a `RECOVERY_TOKEN` shorter than 32 characters will refuse to start until the value is replaced. The startup error names the variable and gives the command to generate one. `RECOVERY_TOKEN` is meant to be set, used once, and unset, so few deployments hold one at any time.
- Recovery attempts land in `login_attempts` with an empty email. `loginFailures` only ever compares against a real key, so those rows never join an email bucket.
- The placeholder hash costs one Argon2 computation per process, on the first failed login.
- Login and recovery now depend on the request object, so they can no longer be called from a context that has none. That is correct: an address-based control cannot be honored by a caller that has no address.

## Alternatives considered

- **Trust the leftmost `X-Forwarded-For` entry.** The conventional reading, and entirely client-controlled: an attacker sets the header and picks a fresh bucket per request. Rejected.
- **Count a fixed number of proxy hops from the right.** Correct where the hop count is fixed and known, but it silently mis-resolves when the topology changes, and the failure is invisible. The CIDR walk degrades to null instead.
- **Keep a shared bucket for unresolvable addresses, with a higher threshold.** Still a shared bucket, so still a denial-of-service lever; only the price changes. Rejected.
- **Compare against a hard-coded placeholder hash constant.** Cheaper than generating one per process, but it puts a credential-shaped literal in the source that the secret scanner would have to be taught to ignore.
- **Throttle recovery by email as well as address.** Rejected: it protects nothing the token entropy floor does not already protect, and it creates a way to lock a named administrator out of login.
