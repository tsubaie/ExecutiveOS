# ExecutiveOS

An open-source operating surface for executives and their offices. One place to run tasks, meeting notes, committees, KPIs, and strategic initiatives, with AI assistance built in.

ExecutiveOS is self-hosted, multi-user, and bilingual-ready (English and Arabic ship in the box, with full RTL support). It runs as a single web application plus a PostgreSQL database. There is no separate worker process and nothing to install besides Docker; AI features call the Claude API directly from inside the app with your own API key.

## Status

Pre-implementation. This repository holds the product and engineering specification (revised after an external review on 2026-09-07; see `SPEC-REVIEW.md` and `docs/REVIEW-RESPONSE.md`). Read `docs/README.md` for the reading order.

## Modules (v1)

| Module | What it does |
|---|---|
| Home | Next meetings, prep not ready, overdue actions, pending AI reviews |
| Tasks | GTD-style tasks with subtasks, owners, priorities, due-date bands, and links to committees, initiatives, meetings, and notes |
| Notes | Thread-first meeting notes with types, tags, and AI refinement that extracts tasks |
| Committees | Standing bodies (boards, councils, internal committees) that group tasks and notes |
| KPIs | Objectives, KPIs, readings, quarterly targets, and computed status |
| Initiatives | Strategic initiatives with deliverables, planned-vs-actual progress, health updates |
| Meetings | Meetings with attendees, agenda, documents, AI executive briefs, minutes, and actions |
| People | Lightweight directory of the people linked to tasks, meetings, and notes |
| Links | A typed context graph: link any entity to any other (person↔task, KPI↔meeting, …) |
| Admin | Users, settings, AI configuration, learnings review, backups, export, jobs, audit log |

Later modules (not in v1): My Day, Relationships cadence tracking, Daily Check-in, Calendar and Email integrations.

## Stack

Next.js (App Router) · TypeScript strict · PostgreSQL 16 · Drizzle ORM · Zod · TanStack Query · Tailwind CSS v4 + shadcn/ui · next-intl · Claude API (`@anthropic-ai/sdk`) · Vitest + Testing Library · Playwright.

## Run with Docker

WI-0001 is being implemented; see `HANDOFF.md` for the current milestone and verification status. The commands below are the intended completed-stack workflow, not a claim that the in-progress branch already serves the application.

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

Once the implementation and audit scripts are complete, run checks inside the development container:

```bash
docker compose exec app pnpm test
docker compose exec app pnpm test:e2e
docker compose exec app pnpm audit:all
```

Restore is destructive and requires explicit confirmation, as specified by ADR 0008:

```bash
docker compose exec app pnpm backup:restore /var/lib/executiveos/backups/BACKUP_ID --confirm
```

## Documentation

Everything lives under `docs/`. Start with `docs/README.md`. If you are an AI agent working in this repo, read `AGENTS.md` first.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.
