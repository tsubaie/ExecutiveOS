# 04 — API conventions

All HTTP endpoints live under `/api/v1/`. They serve the web UI now and external clients later. The rules here are enforced by `core/http/handler.ts`, by generated OpenAPI, and by API tests.

## Handler wrapper

```ts
export const tasksApi = {
  list: defineHandler({
    guard: "session",
    query: TaskListQuery,
    response: listOf(TaskListItem, { counts: TaskCounts }),
    handler: async ({ query, ctx }) => listTasks(ctx, query),
  }),
  create: defineHandler({
    guard: "session",
    idempotent: true,                 // requires Idempotency-Key
    body: TaskCreate,
    response: entity(Task),
    status: 201,
    handler: async ({ body, ctx }) => createTask(ctx, body),
  }),
};
```

`defineHandler` does, in order: request id; guard (`"session"` | `"admin"` | `"public"`, mandatory); same-origin check for state-changing methods; parse `params`, `query`, `body`; idempotency lookup; call the handler with `ctx` (`user`, `requestId`, `locale`, `timezone`, `db`); validate the result against `response` in development and test; serialize; map errors; log. Every handler declares `response`; OpenAPI is generated from `query`, `body`, `response`, `status`, and the error codes the handler lists in `errors`.

## Response envelopes

Entity: `{ "data": { … } }`. List: `{ "data": [ … ], "meta": { … } }`. Error: `{ "error": { "code", "message", "details", "requestId" } }`.

Rules:

- Fields in `data` are never omitted; absent values are `null`. Optional fields exist only in `meta` (`total`, `nextCursor`, `counts`) and are documented per endpoint.
- Dates are ISO 8601 strings with offset; `date` columns are `YYYY-MM-DD`. Numbers are numbers (range guaranteed by the data model).
- Exceptions to the envelope, each declared in OpenAPI: `204` for deletes and restores; binary streams for file downloads (`Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`); `GET /health` returns a bare object.
- `message` is localized to `ctx.locale`; `code` and `details` are stable and machine-readable.

## Error codes

| HTTP | code | details |
|---|---|---|
| 400 | `validation_failed` | `{ fieldErrors: Record<path, string[]> }` with dotted paths for nested fields (`tasks.2.title`) |
| 401 | `unauthenticated` | |
| 403 | `forbidden` | `{ reason: "role" \| "origin" \| "private" }` |
| 404 | `not_found` | `{ entityType }` |
| 409 | `conflict` | `{ reason: "revision" \| "unique" \| "state" \| "duplicate", current?: entity, existing?: { id } }` |
| 422 | `rule_violation` | `{ rule: "<MODULE>-B<nn>" }` naming the requirement |
| 429 | `rate_limited` | `{ retryAfterSeconds, scope: "login" \| "ai" \| "upload" \| "queue" }` |
| 503 | `ai_unavailable` | `{ reason: "disabled" \| "not_configured" \| "budget" \| "provider" }` |
| 502 | `ai_failed` | `{ reason: "refused" \| "invalid_output" \| "timeout" }` (job results; surfaced through the job endpoint) |
| 500 | `internal` | none; log by request id |

Services throw `AppError(code, details?, messageKey?)`. Retryability: 429, 502, 503, and network errors are retryable by the client; nothing else is.

## Resources and verbs

| Verb | Path | Meaning |
|---|---|---|
| GET | `/<resource>` | list |
| POST | `/<resource>` | create; 201; idempotent |
| GET | `/<resource>/:id` | detail |
| PATCH | `/<resource>/:id` | partial update; body includes `revision`; returns the entity |
| DELETE | `/<resource>/:id` | soft delete; 204; response header `X-Op-Id` |
| POST | `/<resource>/:id/restore` | body `{ opId }`; 200 with the entity |
| POST | `/<resource>/:id/<action>` | state change with side effects; body includes `revision`; idempotent |
| GET/POST | `/<resource>/:id/<children>` | owned collections; creates are idempotent; child rows carry their own `revision` when editable |

## Concurrency

- Every entity and editable child row has `revision`. PATCH and action bodies MUST include `revision`; the update is `WHERE id AND revision`, and zero rows returns 409 `conflict` with `reason: "revision"` and the current entity in `details.current`.
- Child creates (a reading, an update) do not take the parent's revision; they hold a row lock on the parent inside the transaction so derived values are computed consistently.
- Autosave in the UI serializes edits per entity (one in flight, latest coalesced) and keeps the local draft on 409 so the user can reapply.

## Idempotency

State-creating requests (`POST` creates, `apply`, `merge`, `group`, action routes) require an `Idempotency-Key` header (UUID). The wrapper stores `(user, key, request hash, status, body)` for 24 hours; a repeat with the same hash replays the stored response; a repeat with a different hash returns 409 `conflict` `reason: "duplicate"`. The API client generates keys per mutation attempt and reuses the key on retry.

## Lists: filtering, sorting, paging

- Filters are explicit query params validated per resource. Unknown params → 400.
- `view` is a named preset defined in `service.ts` and reused for `meta.counts`. `meta.counts` counts each view **with the current facets and `q` applied**, so the rail reflects the visible subset.
- `q` searches the resource's `search_text` (normalized, trigram). The spec lists the fields.
- `sort` is one of an allowlist; each allowed sort is an explicit ordered tuple ending in `id`, documented per resource with null placement (nulls last ascending, first descending) and the rank used for enum fields. Example tasks default: `(band_rank asc, due_date asc nulls last, priority_rank desc, created_at desc, id desc)` where `band_rank` is computed relative to `today` in `ctx.timezone` at request time.
- Cursor: opaque base64 of `{ v: 1, sort, filtersHash, last: [tuple values] }`. A cursor whose `sort` or `filtersHash` does not match the request → 400. Cursors are valid for the request's day; the band rank can change across midnight, so the UI restarts from the first page when the day changes (it already refreshes on the day boundary, `TASKS-B03`).
- `limit` default 50, max 200. `withTotal=true` adds `meta.total`.
- `includeDeleted=true` only where the spec says (trash views).
- `linkedTo=<type>:<id>` and `relation=` are accepted by every list of a linkable entity type. For thread lists they match any note in the thread.

## Auth endpoints

| Path | Notes |
|---|---|
| POST `/auth/login` | `{ email, password }`; rate limited (5 failures / 15 min per email and per IP); sets cookie; returns the user |
| POST `/auth/logout` | revokes the session |
| GET `/auth/me` | user, role, locale, timezone, enabled modules, AI availability |
| GET/DELETE `/auth/sessions` | own sessions |
| POST `/setup` | only while `users` is empty; requires `setupToken`; locks `workspace` |
| POST `/recovery` | present only when `RECOVERY_TOKEN` is set; single use |
| POST `/auth/password` | change own password; revokes other sessions |

## CSRF and origin

- Same-origin deployment is required: `APP_URL` is the only origin. No CORS headers are emitted; credentialed cross-origin requests are impossible by default.
- Every state-changing request must carry `X-Requested-With: ExecutiveOS` **and** an `Origin` (or `Referer`) whose origin equals `APP_URL`. Missing or mismatched → 403 `forbidden` `reason: "origin"`. This applies to login, setup, recovery, multipart uploads, and all mutations.
- Cookie `SameSite=Lax`, `Secure` when `APP_URL` is https.
- `X-Forwarded-For` is trusted only from `TRUSTED_PROXY_CIDRS`.

## Files

- Upload: `POST /meetings/:id/documents` multipart, streamed; limits per `02-architecture.md`. File signature (magic bytes) must match the declared type.
- Download: `GET /meetings/:id/documents/:docId/file` streams with attachment headers; requires session; path resolved inside `FILES_DIR` (`core/files.resolveInside`).

## Jobs

`GET /jobs/:id` → `{ data: { id, kind, status, attempt, createdAt, startedAt, finishedAt, error: { code, message } | null, result: <kind result> | null } }`. Only the creator or an admin may read a job. `POST /jobs/:id/cancel` (admin or creator).

## Cache invalidation contract

Each mutation's spec lists the query keys it invalidates. The rule: invalidate the entity's `detail`, every `list` and `counts` of its own module, the `links` keys of both ends for link changes, and the `detail` of every entity whose displayed statistics change (old and new parent on reassignment). Query keys include `locale` where the payload is locale-dependent (prep status, enum labels are not since labels are client-side). All caches are cleared on logout and on user switch.

## Health

`GET /health` per `02-architecture.md`.

## Versioning and OpenAPI

`/v1` is stable within a major release; additive changes only. `scripts/audit/openapi.ts` generates `openapi.json` from the handler registrations (inputs, responses, status codes, declared errors) and CI diffs it.
