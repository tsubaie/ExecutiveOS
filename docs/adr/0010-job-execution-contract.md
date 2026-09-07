# ADR 0010 — Job execution contract: leases, fencing, dedup keys, all AI as jobs

**Status:** accepted (2026-09-07). Extends ADR 0003.

## Context

ADR 0003 chose an in-process Postgres-backed runner but specified only atomic claiming. The review showed that without leases and fencing a slow first attempt could run concurrently with a reclaimed second attempt and both could publish results, duplicating Claude calls and side effects. Inline AI calls also bypassed admission and accounting.

## Decision

- **At-least-once** execution. Claim with `SKIP LOCKED`; hold a 2-minute lease renewed every 30 seconds; a job whose lease expired is claimable again.
- **Fencing**: `attempt` increments on claim and every write by a handler (heartbeat, result, failure) is conditional on `attempt` and `lease_owner`; a late writer updates zero rows and its transaction rolls back.
- **Atomic publication**: handler side effects and the status update happen in one transaction.
- **Idempotent handlers**: side effects are keyed by `job_id` or `dedup_key`; every handler is tested by running twice.
- **Dedup keys**: unique among non-terminal jobs; producers get the existing job instead of a duplicate.
- **Cancellation, deadlines, attempts log, per-kind concurrency and admission** as in `02-architecture.md`.
- **Scheduler** inserts due occurrences with `dedup_key = kind:occurrence`; catch-up policy is latest-missed-only.
- **All AI calls run as jobs.** There is no inline mode; short capabilities are simply fast jobs the UI polls. SDK retries are disabled so one attempt equals one API call and budget accounting is exact.
- v1 runs one application instance; the contract is still designed so a second instance would be safe, but shared file storage and cluster admission are out of scope.

## Consequences

- One execution path for every AI capability and every scheduled task.
- Two-second polling latency for short capabilities; acceptable for tag suggestions and breakdowns.
- The core adversarial suite includes lease expiry, late writer rejection, and runner kill/restart scenarios.
