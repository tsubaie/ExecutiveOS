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

## Quick start (target, once implemented)

```bash
cp .env.example .env          # set DB password, SESSION_SECRET, APP_URL, optional ANTHROPIC_API_KEY
docker compose up -d
docker compose logs app | grep SETUP_TOKEN
# open APP_URL and complete first-run setup with the token
```

Production needs a reverse proxy with TLS in front (Caddy example in `docs/02-architecture.md`); secure cookies require https.

## Documentation

Everything lives under `docs/`. Start with `docs/README.md`. If you are an AI agent working in this repo, read `AGENTS.md` first.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.
