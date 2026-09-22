# Hand-off: backup restore hardening (#50)

Status: complete, pending the maintainer's review

## Summary

Restore used to extract `files.tar` straight into live files, then run `pg_restore`, then clear
maintenance mode with a bare `unlink`. Any failure left `.maintenance` behind, so the app answered
503 until someone deleted it. A failure after extraction also left a mixed file tree. It now
verifies sizes and checksums, extracts into a staging directory inside `FILES_DIR` under entry,
byte and deadline limits, and runs `pg_restore` in one transaction. Only after that commits does it
swap the staged files in, with rollback. Staging and maintenance are cleared on every exit.
Backups observe their abort signal in every phase and remove their staging directory when they do
not finish. The job runner now drains: it stops claiming, waits up to `JOBS_DRAIN_SECONDS`, then
aborts and records the rest. `SIGINT` is handled like `SIGTERM`, and the production image lets the
drain, not Next, decide when the process exits. ADR 0024 records the order and the drain.

## Requirement → scenario

| ID | Test file | Scenario name |
|---|---|---|
| ADMIN-B31 | `src/core/backup/tests/restore.test.ts` | ADMIN-B31 swaps files in only after pg_restore commits, and leaves no workspace behind |
| ADMIN-B31 | `src/core/backup/tests/restore.test.ts` | ADMIN-B31 a pg_restore failure leaves live files untouched and clears maintenance |
| ADMIN-B31 | `src/core/backup/tests/restore.test.ts` | ADMIN-B31 refuses without confirmation and clears maintenance idempotently |
| ADMIN-B31 | `src/core/backup/tests/restore.test.ts` | ADMIN-B31 a failed swap moves every live file back |
| ADMIN-B31 | `src/core/backup/tests/restore.test.ts` | ADMIN-B31 a stale staging directory from an interrupted restore is cleared |
| ADMIN-B31 | `src/core/backup/tests/dump.test.ts` | ADMIN-B31 a backup never captures a restore workspace, and restores round-trip |
| ADMIN-B32 | `src/core/backup/tests/restore.test.ts` | ADMIN-B32 refuses %s and changes nothing (traversal, absolute path, symbolic link, hard link, truncated entry) |
| ADMIN-B32 | `src/core/backup/tests/restore.test.ts` | ADMIN-B32 stops at the entry-count limit |
| ADMIN-B32 | `src/core/backup/tests/restore.test.ts` | ADMIN-B32 stops when expanded bytes exceed the storage quota |
| ADMIN-B32 | `src/core/backup/tests/restore.test.ts` | ADMIN-B32 an archive whose size differs from the manifest is refused before activation |
| ADMIN-B33 | `src/core/backup/tests/restore.test.ts` | ADMIN-B33 the deadline aborts a slow phase and restores nothing |
| ADMIN-B33 | `src/core/backup/tests/restore.test.ts` | ADMIN-B33 an aborted caller signal stops the restore before any change |
| ADMIN-B33 | `src/core/backup/tests/dump.test.ts` | ADMIN-B33 an aborted backup leaves no staging directory behind |
| ADMIN-B33 | `src/core/jobs/tests/runner.test.ts` | ADMIN-B33 stop stops claiming and lets a running handler finish within the drain window |
| ADMIN-B33 | `src/core/jobs/tests/runner.test.ts` | ADMIN-B33 a handler still running after JOBS_DRAIN_SECONDS is aborted and its attempt recorded |
| ADMIN-B33 | `src/core/jobs/tests/runner.test.ts` | ADMIN-B33 stopping twice drains once |
| ADMIN-B33 | `src/core/jobs/tests/runner.test.ts` | ADMIN-B33 SIGTERM and SIGINT drain once and exit with the signal code when Next does not |

Each group was checked against a mutation of the code it covers: dropping the limits and strict
mode, extracting into live files without the `finally`, aborting handlers at once on stop,
removing the size check, and removing the dump cleanup and workspace filter. Each mutation
failed its scenarios.

## Files changed

- core/backup: `pg.ts` (the subprocess, split out of `dump.ts`), `extract.ts` (bounded streaming
  extraction), `swap.ts` (staged swap with rollback), `restore.ts` (new order, options object),
  `dump.ts` (signal in every phase, staging cleanup, workspace filter), `manifest.ts` (size check),
  `maintenance.ts` (idempotent clear); tests and a filesystem fixture helper under `tests/`.
- core/jobs: `runner.ts` (drain), `shutdown.ts` (signal handling); `tests/runner.test.ts`.
- core/config: `env.ts` reads `NEXT_MANUAL_SIG_HANDLE`.
- `src/instrumentation.ts`: installs shutdown handling whether or not jobs are enabled.
- `scripts/backup/restore.ts`: options object, `SIGINT`/`SIGTERM` abort the restore.
- `Dockerfile`: `NEXT_MANUAL_SIG_HANDLE=true` in the runtime stage.
- Docs: `features/admin.md` (ADMIN-B13 wording, new B31–B33, required scenarios),
  `02-architecture.md` (drain paragraph, restore sequence, two resource-limit rows),
  ADR 0024 and the ADR index.

## Migrations

None.

## Audits

See the pull request description for the `pnpm audit:all` summary of the final commit.

## Manual verification

No UI changes. The restore drill is described in the pull request description.

## Assumptions

1. Staging lives inside `FILES_DIR`, because Compose mounts a volume there and `rename` does not
   cross filesystems. Recorded in ADMIN-B31 and ADR 0024.
2. Files are swapped after `pg_restore`, not before, so the more fallible step runs while live
   files are still intact. Recorded in ADR 0024.
3. Link and special entries now fail the restore instead of being skipped silently. A backup
   written by `dump.ts` never contains them. Recorded in ADMIN-B32.
4. The drain lets handlers finish before aborting them, which reverses the literal order in the
   old architecture paragraph. The issue asked for "await, then force-abort". Recorded in ADR 0024.
5. Limits are 200 000 entries and a one-hour deadline, as constants in `restore.ts`, not
   environment variables. Recorded in the resource-limits table.

## Open questions

1. `NEXT_MANUAL_SIG_HANDLE` means Next no longer closes its HTTP server gracefully on shutdown.
   Requests still open when the drain ends are cut at exit. Options: accept this (recommended,
   because the server keeps answering throughout the drain), or keep Next's handling and accept
   that the drain is cut short. This changes deployment behaviour, so please confirm.

## Out of scope, noticed

- `src/core/files/storage.ts` `storageUsage` counts only top-level files, so a restore's staging
  directory does not count against the quota while it exists. That is harmless today.
