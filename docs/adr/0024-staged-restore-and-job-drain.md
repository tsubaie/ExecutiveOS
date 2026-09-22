# ADR 0024 — Restore stages files and swaps them in after the database; the runner drains before it aborts

**Status:** accepted (2026-09-22)

## Context

ADR 0008 describes restore as: set maintenance mode, restore, verify the manifest, clear maintenance mode. The implementation followed that literally. It extracted `files.tar` straight into the live `FILES_DIR`, then ran `pg_restore`, then cleared maintenance mode with a bare `unlink`. A failure after extraction left live files from two points in time; any failure left `.maintenance` on disk, so the app answered 503 until someone deleted it by hand. Extraction had no entry, byte or time limit, and the manifest's `bytes` field was never read (issue #50, consolidating #12 and #13).

Separately, `02-architecture.md` promised that on `SIGTERM` the runner waits up to `JOBS_DRAIN_SECONDS` before exiting. The runner aborted every handler at once and never waited, `SIGINT` was ignored, and Next's own signal handler exits the process as soon as its HTTP server closes, which would cut any drain short anyway (#27).

## Decision

**Restore order.** Verify each file's size and then its checksum; enter maintenance mode; extract into a unique `.restore-*` directory inside `FILES_DIR`; run `pg_restore --single-transaction`; only after it commits, retire the live entries into a `.previous-*` directory and move the staged entries in; remove the retired set. A `finally` always removes staging and clears maintenance mode, and clearing tolerates a missing file.

- Staging lives **inside** `FILES_DIR` because in Compose that directory is a volume mount point. It cannot be renamed itself, and `rename` is only atomic within one filesystem. The swap is therefore per entry rather than a single rename. It is rolled back on failure, and if rollback also fails the retired entries are kept rather than deleted.
- Files move **after** the database, not before. A database that failed to restore then leaves the live files exactly as they were, and the database step is the one that can fail for reasons outside the archive.
- Backups exclude `.restore-*` and `.previous-*`, so a scheduled backup during a restore does not capture a half-built tree.

**Extraction limits.** Extraction streams through counters and aborts at the first entry past 200 000 entries or past `min(FILES_QUOTA_GB, verified archive size)` expanded bytes, before writing it. Only regular files and directories are accepted, and anything else fails the restore. `files.tar` is uncompressed, so the byte cap is mostly a guard against a manifest that lies. A one-hour deadline and the operator's `SIGINT`/`SIGTERM` abort every phase before the swap.

**Drain.** Stopping the runner stops claiming, waits for running handlers up to `JOBS_DRAIN_SECONDS`, then aborts the rest and waits five seconds so each records its attempt, which retries later. Handlers are not aborted first: an AI call or a backup that would finish in ten seconds should finish rather than be paid for twice. `SIGINT` is handled like `SIGTERM`. The production image sets `NEXT_MANUAL_SIG_HANDLE=true`, so Next does not exit on the signal and the app exits after the drain with 143 or 130. In `next dev`, where manual handling is unavailable, Next still exits on its own schedule and the drain is best effort.

## Consequences

- A failed restore leaves the installation serving the data it had before, instead of a 503 or a mixed file tree.
- A restore needs free space for a second copy of the files on the files volume while it runs.
- With manual signal handling, requests in flight when the drain ends are cut off at exit rather than closed gracefully by Next. The drain window is also a window in which the server keeps answering, so in practice only long requests are affected.
- ADR 0008's "restores, verifies the manifest" order is superseded for restore only. Everything else in 0008 stands.

## Alternatives considered

- **Swap files before `pg_restore`.** Rejected: the more fallible step would then run after live files had already changed.
- **Stage in `BACKUP_DIR` and copy.** Rejected: that is a different volume, so the move would be a copy, neither atomic nor cheap.
- **Abort handlers immediately, then wait.** This is the literal old wording. Rejected because it wastes nearly finished work on every deploy, and the job contract already makes an aborted attempt safe to retry.
- **Keep Next's signal handling and race it.** Rejected: Next exits once its server closes, usually well inside the drain window, so the drain would silently not happen.
