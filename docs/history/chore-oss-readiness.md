# Hand-off: chore/oss-readiness — publication surface

Status: complete for its scope. The full `pnpm audit:all` gate runs once on this final branch; its summary is appended below when it finishes.

## Summary

The repository now reads like a project a stranger can pick up: a README status that matches reality and points at `docs/STATUS.md`, contributor and conduct documents, issue and pull request templates mirroring the PR audit in `docs/09`, a security policy with a reporting channel, Node pinned for local toolchains, and eight representative screenshots instead of ninety-two. Hand-offs, unused dependencies and dead exports were handled in the earlier branches of this series.

## Files changed

- `README.md` (Status, checks, screenshots, hand-off pointers), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` (reporting channel, supported versions), `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/feature.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.mise.toml`, `.nvmrc`.
- `docs/screenshots/`: kept `home-en-desktop`, `home-ar-desktop`, `tasks-list-en-desktop`, `tasks-list-ar-desktop`, `tasks-detail-en-desktop`, `people-list-ar-desktop`, `admin-settings-en-desktop`, `login-ar-desktop`; removed 84 files (4.3 MB → 440 KB). `tools/capture-*.mjs` write the full matrix to the ignored `tmp/screenshots/`.
- `docs/02-architecture.md` layout (new root files), `docs/STATUS.md` regenerated.
- Removed three unused helper exports (`resetEnv`, `settingEntry`, `resetMaintenanceCache`) so `audit:deps` stays clean.

## Migrations

None.

## Assumptions

1. `SECURITY.md` names GitHub Security Advisories as the private channel; the maintainer supplies an email address in the repository description if they prefer one.
2. The Code of Conduct is an adaptation of the Contributor Covenant 2.1 with attribution, not the verbatim text.

## Out of scope, noticed

- A `CHANGELOG.md` and the release checklist in `docs/09` § F remain for the 1.0 hardening phase.
- The Docker image publication and the clean-VM quick-start drill are release tasks.
