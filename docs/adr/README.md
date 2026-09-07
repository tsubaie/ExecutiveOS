# Architecture Decision Records

One decision per file. Format: **Status**, **Context**, **Decision**, **Consequences**, **Alternatives considered**. Accepted ADRs are never edited except to add a superseded-by line; a new ADR supersedes them. `audit:docs` checks that accepted ADR bodies are unchanged since acceptance.

| # | Title | Status |
|---|---|---|
| 0001 | Next.js App Router with TypeScript as the single deployable | accepted |
| 0002 | PostgreSQL with Drizzle ORM and generated plus custom migrations | accepted |
| 0003 | In-process AI via the Claude API and a Postgres-backed job runner | accepted, extended by 0010 |
| 0004 | shadcn/ui on Base UI with semantic tokens as the design system | accepted |
| 0005 | Own multi-user auth with cookie sessions and roles | accepted |
| 0006 | Hybrid linking with mirrored structural relations | superseded by 0009 |
| 0007 | Local file storage and native PDF input for meeting briefs | accepted |
| 0008 | Scope of the "no CLI" rule; backups with bundled PostgreSQL client binaries | accepted |
| 0009 | Contextual links table plus a projected edges view | accepted |
| 0010 | Job execution contract: leases, fencing, dedup keys, all AI as jobs | accepted |
| 0011 | People are the single identity for task owners and attendees | accepted |

Open decisions awaiting an ADR: license (see roadmap); chart library confirmation (`recharts`); markdown editor component.
