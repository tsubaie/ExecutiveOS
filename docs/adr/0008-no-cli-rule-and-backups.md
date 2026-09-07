# ADR 0008 — Scope of the "no CLI" rule; backups with bundled PostgreSQL client binaries

**Status:** accepted (2026-09-07)

## Context

The owner's requirement is that ExecutiveOS must not depend on a separately running application or a locally installed CLI, specifically so that AI features work from inside the app through APIs rather than by spawning a Claude CLI. The external spec review read the rule literally and found it in conflict with using `pg_dump` for backups and `pnpm db:migrate` at startup.

## Decision

The rule means: **no dependency on software the operator must install separately or run as another service, and no subprocess-based AI.** It does not forbid binaries bundled inside the application image. Concretely:

- AI: only the Anthropic SDK over HTTPS. No `child_process` anywhere except `core/backup`.
- Backups and restore: `core/backup` invokes `pg_dump` and `pg_restore` from the `postgresql-client` package installed in the image. Backups produce a directory with `db.dump` (custom format), `files.tar`, and `manifest.json` (checksums, schema version, app version, counts). Consistency comes from the write ordering: files are immutable and written before their DB row, and the dump is taken before the tar, so every file referenced by the dump exists in the tar.
- Restore: `pnpm backup:restore <dir>` is an operator command run inside the container (`docker compose exec app pnpm backup:restore …`). It sets maintenance mode, restores, verifies the manifest, and clears maintenance mode. Restoring loses writes made after the backup; the command says so and requires `--confirm`.
- Migrations run in-process through Drizzle's migrator (a library, not a CLI) at startup under an advisory lock.

## Consequences

- Backups stay compatible with standard PostgreSQL tooling.
- The image carries the client package (about 15 MB).
- `scripts/audit` forbids `child_process` outside `core/backup` and tests that module's argument construction against injection.

## Alternatives considered

- **In-app logical backup format**: satisfies the literal rule at the cost of weeks of engineering, no `pg_dump` compatibility, and a bespoke restore path. Rejected.
- **No backups in v1**: unacceptable because restore is the migration rollback path (ADR 0002).
