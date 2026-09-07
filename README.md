# ExecutiveOS

An open-source operating surface for executives and their offices. One place to run tasks, meeting notes, committees, KPIs, and strategic initiatives, with AI assistance built in.

ExecutiveOS is self-hosted, multi-user, and bilingual-ready (English and Arabic ship in the box, with full RTL support). It runs as a single web application plus a PostgreSQL database. There is no separate worker process and nothing to install besides Docker; AI features call the Claude API directly from inside the app with your own API key.

## Status

Runnable development preview: setup/login, Home, administration surfaces, and a PostgreSQL-backed People slice in English and Arabic. WI-0001 is incomplete: the full audit gate, several core hardening requirements, and framework behaviors remain outstanding. See `docs/history/HANDOFF.md` for verified behavior and the exact gaps. The v1 module table below describes the intended product, not completed modules.

## Modules (v1)

| Module      | What it does                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Home        | Next meetings, prep not ready, overdue actions, pending AI reviews                                                           |
| Tasks       | GTD-style tasks with subtasks, owners, priorities, due-date bands, and links to committees, initiatives, meetings, and notes |
| Notes       | Thread-first meeting notes with types, tags, and AI refinement that extracts tasks                                           |
| Committees  | Standing bodies (boards, councils, internal committees) that group tasks and notes                                           |
| KPIs        | Objectives, KPIs, readings, quarterly targets, and computed status                                                           |
| Initiatives | Strategic initiatives with deliverables, planned-vs-actual progress, health updates                                          |
| Meetings    | Meetings with attendees, agenda, documents, AI executive briefs, minutes, and actions                                        |
| People      | Lightweight directory of the people linked to tasks, meetings, and notes                                                     |
| Links       | A typed context graph: link any entity to any other (person↔task, KPI↔meeting, …)                                            |
| Admin       | Users, settings, AI configuration, learnings review, backups, export, jobs, audit log                                        |

Later modules (not in v1): My Day, Relationships cadence tracking, Daily Check-in, Calendar and Email integrations.

## Stack

Next.js (App Router) · TypeScript strict · PostgreSQL 16 · Drizzle ORM · Zod · TanStack Query · Tailwind CSS v4 + shadcn/ui · next-intl · Claude API (`@anthropic-ai/sdk`) · Vitest + Testing Library · Playwright.

## Run with Docker

The production-shaped image and Compose stack have been built and run locally. First boot applies migrations and prints `SETUP_TOKEN`. Open http://localhost:3000 and complete setup; then sign in with the account you created.

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD and the matching password in DATABASE_URL.
# Set a random SESSION_SECRET of at least 32 characters, and APP_URL.
docker compose up -d --build
docker compose logs app
# open APP_URL and complete first-run setup with the token
```

The database password is required; Compose refuses an empty value. The database has no published port. The application binds to localhost port 3000; production needs a TLS reverse proxy and an HTTPS `APP_URL`. AI remains disabled when `ANTHROPIC_API_KEY` is empty.

Development with bind-mounted source and hot reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

The development override publishes PostgreSQL on localhost only. Use a separate disposable database for `DATABASE_URL_TEST`; never point tests at production.

The complete audit gate is not green yet. Checks run from the source checkout with Node 22; the exact Docker tooling commands used for this preview are in `docs/history/HANDOFF.md`:

```bash
docker compose exec app pnpm test
docker compose exec app pnpm test:e2e
docker compose exec app pnpm audit:all
```

After setup, load the six invented preview people (repeat-safe):

```bash
docker compose exec app pnpm db:seed
```

Screenshots are under `docs/screenshots/`; unsuffixed screenshots use the dark theme, and `-light.png` files show the light theme.

Restore replaces the target database and requires explicit confirmation, as specified by ADR 0008:

```bash
docker compose exec app pnpm backup:restore /var/lib/executiveos/backups/BACKUP_ID --confirm
```

## Development

Run the checks from the source checkout with Node 22 and pnpm (`corepack enable`). Unit and integration suites need a disposable PostgreSQL database whose name ends in `_test`; the suite refuses anything else and creates the database when it is missing:

```bash
docker compose -f docker-compose.test.yml up -d   # PostgreSQL on localhost:5433
cp .env.test.example .env.test                    # loaded automatically by pnpm test
pnpm test
```

Browser tests run against a production build. Playwright starts the standalone server unless something is already listening on port 3000, and the global setup creates the browser-test administrator through the real first-run setup API on an empty database. Point `DATABASE_URL` at a database other than the unit-test one (for example `executiveos_e2e_test`); the unit suites truncate tables and would otherwise be mistaken for an initialized workspace. Against an already initialized preview, put an existing administrator's `{"email","password","name"}` in the ignored `e2e/.auth/credentials.json` first:

```bash
pnpm build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
pnpm test:e2e
```

`pnpm audit:all` is the full gate; `.github/workflows/ci.yml` runs it on every pull request. Locally it needs the `gitleaks` binary for `audit:secrets` and a production build for `audit:bundle`, `audit:openapi`, and `audit:a11y`. `pnpm audit:docs --status` regenerates `docs/STATUS.md`.

## Documentation

Everything lives under `docs/`. Start with `docs/README.md`. If you are an AI agent working in this repo, read `AGENTS.md` first.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.

## Task management preview

Open [Tasks](http://localhost:3000/tasks?view=all) after signing in. The current preview includes assignment through People, due-date views, priorities, inline editing, subtasks, grouping, completion, and trash/restore in English and Arabic. Home shows task summaries, and People detail links to assigned work.

Update the local running stack without resetting its database:

```bash
docker compose up -d --build
```

Migrations apply on startup. See [the Tasks hand-off](docs/history/TASKS-HANDOFF.md) for validation, screenshots, assumptions, and deferred functionality. The earlier [WI-0001 hand-off](docs/history/HANDOFF.md) still records unfinished foundation work.
