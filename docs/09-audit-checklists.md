# 09 — Audit checklists

Audits keep an agent-built codebase honest. Script audits run in `pnpm audit:all` and are themselves tested against violating fixtures. Checklist audits are walked by an agent or reviewer and pasted into the PR with evidence (file, scenario name, command output), never a bare "yes".

## A. Script audits

| Script | Checks | Enforcement |
|---|---|---|
| `audit:structure` | Module manifest (`02-architecture.md`), no extra top-level entries, every module has a spec, every linkable module registers a link resolver and a job kind file if it declares jobs | runtime |
| `depcruise` | Layering matrix on the real import graph including barrels, aliases, dynamic imports; `server-only` boundaries; no cycles | static |
| `audit:bundle` | No server code markers in client chunks; route-specific client JS (chunks beyond the root bundle every route loads) ≤ 250 KB gzipped, measured on the production build; the root bundle size is reported so growth stays visible | runtime |
| `audit:i18n` | Catalog key parity; every literal `t('key')` resolves; ICU syntax valid and argument names equal in both catalogs; dynamic keys (`t(value)`, template keys) are reported per file as warnings because they cannot be resolved statically | runtime |
| `audit:portability` | Tripwire denylist outside allowed locations; timezone and locale literals outside allowed locations | runtime |
| `audit:secrets` | `gitleaks` over the tree and history; CI installs the binary, a local run without it fails with an install hint | runtime |
| `audit:schema` | Migrations apply to an empty database; `drizzle-kit check`; `pg_catalog` matches `schema/db.ts` plus the custom objects declared in `drizzle/custom-objects.json`; every FK indexed; table-class columns; CHECKs contain every Zod enum option | runtime |
| `audit:docs` | Every spec has the header fields and the `Purpose`, `Acceptance criteria`, `Required scenarios` sections; every requirement ID named in a test or a `rule` detail exists in a spec; for specs with `Status: implemented` every `-B` and `-A` ID appears in a test name (reported as a warning for `accepted` specs); ADR index matches files; accepted ADRs unchanged since acceptance except the `Status` line; `--status` writes `docs/STATUS.md` | runtime |
| `audit:tests` | Every module has `tests/` with at least one scenario file; modules whose spec is `implemented` have every layer file from `08-testing-strategy.md` and a mutation-target list in the spec; no `fs` reads in tests outside audit self-tests; no skipped tests without issue links | runtime |
| `audit:deps` | `knip`; one library per concern; exact versions; `pnpm audit` has no high or critical advisory without a dated entry in `scripts/audit/deps-exceptions.json` | runtime |
| `audit:dupes` | `jscpd` on files changed against `main` (`--all` for the whole tree, used by `audit:all`); any duplicated block of ten or more lines fails | runtime |
| `audit:openapi` | Regenerate and diff | runtime |
| `audit:a11y` | Playwright + axe on every route, both locales; zero serious or critical | runtime |
| `audit:perf` | Seed `--large`; first-page list services ≤ 300 ms and ≤ 6 queries on golden paths, measured through the query logger in the CI container | runtime |

## B. Pull request audit (every PR)

```
### PR audit
- [ ] Work item id and link
- [ ] Requirement → test table (below), all IDs covered
- [ ] Spec updated: sections …  (or "no behavior change")
- [ ] ADR: none | new ADR nnnn (accepted ADRs untouched)
- [ ] `pnpm audit:all` summary pasted
- [ ] Migrations: none | drizzle/<file>: applies to empty and seeded DB; custom SQL reviewed
- [ ] i18n keys added to en and ar
- [ ] RTL and mobile: e2e scenario names or screenshots for affected screens
- [ ] Error states: every new mutation has a failure toast scenario
- [ ] Dependencies: none | justified
- [ ] Assumptions recorded (where) / open questions
```

| Requirement ID | Test file | Scenario name |
|---|---|---|

## C. Module audit (before a module is called done)

1. **Spec parity.** Every behavior and acceptance ID implemented and tested, or explicitly deferred with a reason.
2. **Invariants.** Service scenario and constraint scenario per invariant.
3. **Lists.** View/count equality under facets, sort tuples, cursor continuation, `linkedTo`, search normalization.
4. **Entity framework compliance.** Uses `EntityPage`; `grep` for `useSearchParams`, `matchMedia`, `innerWidth` in the module returns nothing.
5. **Relationships.** Structural columns and contextual links behave per the relationship inventory; delete/restore with provenance; context query returns the module's edges.
6. **Concurrency.** Revision 409 scenarios; idempotent replay scenarios; autosave draft preservation.
7. **AI.** Capability scenarios (fixture, adversarial, drift, request capture, apply idempotency, stale 409, disabled).
8. **i18n and RTL.** Golden path in `ar`; overflow and focus measurements pass at 320 and 390 px.
9. **Accessibility.** axe clean; keyboard walkthrough scenario.
10. **Performance.** `audit:perf` passes for the module's lists.
11. **Mutation tests.** The module's three listed critical functions are covered by `test:mutate` and the suite fails when they are inverted.
12. **Docs.** Spec `Status` set to `implemented`; README module table accurate.

## D. Security audit (each release; whenever auth, settings, jobs, files, or AI change)

- [ ] Every route declares a guard; wrapper refuses missing guards (test).
- [ ] Admin routes: 403 scenario for members. Private tables: cross-user scenarios across API, server components, jobs, audit, export.
- [ ] Sessions: hashed tokens; sliding and absolute expiry; logout, password change, deactivation revoke; cookie flags in production.
- [ ] Setup token required; setup race; recovery token single-use; last-admin protection.
- [ ] Login rate limit per email and IP; proxy trust configured; `login_attempts` pruned.
- [ ] Origin check and custom header on every state-changing route including login, setup, uploads (tests).
- [ ] Settings registry rejects secret-like keys; per-role read and write allowlists tested.
- [ ] Jobs: payload validation; fencing; only creator or admin reads a job.
- [ ] AI: content framed as data; no tools; two-stage validation; nothing auto-applied; learnings require activation; disclosure list accurate.
- [ ] Files: signature check; size and page limits; path containment; download headers; storage quota; orphan sweep; purge respects references.
- [ ] Parsers (PDF page count, DOCX via mammoth) run with size limits and a timeout; ZIP expansion bounded.
- [ ] CSP set (`default-src 'self'`, no remote images in AI markdown); service worker excludes API and downloads.
- [ ] Logs redact secrets, tokens, prompt bodies, private notes; audit diffs exclude sensitive fields.
- [ ] Dependencies: `pnpm audit` policy; `gitleaks` clean.
- [ ] Docker: non-root; DB password required in `.env` (compose fails without it); DB port not published by default.
- [ ] `SECURITY.md` present with reporting process and supported versions.

## E. Internationalization audit (each release)

- [ ] `ar` user: every route RTL; nav mirrored; chevrons flipped; numerals per setting; dates in workspace timezone.
- [ ] Mixed-direction titles and inputs render correctly (`<bdi>`, `dir="auto"`).
- [ ] No overflow at 320 px in `ar` (measured).
- [ ] Enum labels, empty states, toasts, dialogs, validation messages translated.
- [ ] Two-configuration e2e run passes (different timezone, locale, workspace name, principal).

## F. Release audit

- [ ] `pnpm audit:all`, e2e, and nightly suites green on `main`.
- [ ] Fresh `docker compose up` on a clean Linux VM: setup with printed token, one entity per module.
- [ ] Backup created, manifest verified, restored into a fresh stack, app boots, golden paths pass.
- [ ] Upgrade drill from the previous release's backup: migrations apply under lock, no manual steps; interrupted migration leaves the lock released and the app refusing to serve.
- [ ] Export produced and opened (manifest, JSON, markdown, documents).
- [ ] `CHANGELOG.md`, version bump, image tag, `SECURITY.md`, `LICENSE`, `NOTICE` (fonts and dependencies).
- [ ] Security and i18n audits attached.

## G. Agent self-audit (before every hand-off)

1. Which spec sections and requirement IDs did I implement? Which did I not, and why?
2. What did I assume, and where is each assumption recorded (spec line, ADR, code comment)?
3. For each scenario I added: what breaks if the feature is removed?
4. Did `pnpm audit:all` pass? Paste the summary.
5. Did I change behavior outside the work item? If so, it is in "Out of scope, noticed", not in the PR.
6. Did I search `src/ui` and the module before writing a component or helper? Name what I reused.
