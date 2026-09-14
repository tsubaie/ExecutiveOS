# ADR 0017 — OpenRouter task and note capability execution

**Status:** accepted (2026-09-10)

## Context

The maintainer requested model selection and OpenRouter assistance in tasks and notes. ADR 0016 established the provider and credential storage but deferred generation policy. Vendor-specific thinking, caching and fallback parameters cannot be assumed across the OpenRouter catalog.

## Decision

- Extend ADR 0016 and supersede the vendor-specific execution policy of ADR 0003 for these capabilities. Preserve ADR 0010's durable jobs, leases and publication fences.
- Load the OpenRouter model catalog, cached for one minute. Offer text models advertising structured outputs. Administrators explicitly choose the default model for breakdown/refinement and the fast model for tag suggestions. Recheck the catalog and context/output limits at admission.
- Use the existing SDK's streaming messages API with a JSON schema, abort signal and required-parameter routing. Do not send tools, adaptive thinking, caching hints or model fallback parameters. SDK retries stay disabled; jobs allow at most two attempts. Retry network, rate-limit and invalid-output failures, honoring Retry-After. Refusal and authentication failures are terminal.
- Snapshot input, revision, content hash, locale, prompt/capability versions, selected model, limits and catalog prices in each job. JSON-escape framing delimiters; source text is untrusted data.
- Reserve two attempts conservatively against the workspace monthly token budget under the enqueue advisory lock. Input estimation uses framed UTF-8 bytes plus schema/prompt overhead; it may reject requests a tokenizer would admit. Count every invocation. When usage is unavailable after a failed call, retain the per-attempt reservation as estimated consumption rather than silently refunding it. Active reservations remain counted until jobs terminate.
- Show capability switches, monthly usage/reservations and thirty-day per-capability estimates. Costs use snapshotted catalog input/output prices and are estimates, including undiscounted cache tokens; OpenRouter billing remains authoritative.
- Jobs publish proposals only. Task and note writes require explicit selections, actor authorization and revision checks in a transaction. Reapplying a job returns its recorded task IDs. Note refinement stores one pending review per note; edits make it stale. Task creation reuses the task service, supplied to the note apply service through its API composition boundary.
- This decision covers task breakdown, note refinement and tag suggestions. Other AI capabilities remain planned. Development does not establish verified provider compatibility; verification and deployment await the maintainer's instruction.

## Consequences

Administrators can select multiple vendors through OpenRouter without exposing provider details in task/note workflows. Conservative estimates can reject otherwise affordable requests. A saved key and connection check alone do not establish generation readiness. Live compatibility, bilingual review behavior and admission accounting remain explicit verification work.

## Alternatives considered

- Implicitly choose a paid catalog model: rejected; model selection is an administrator decision.
- Forward Claude-specific thinking/fallback settings to every model: rejected because catalog models differ.
- Apply generated edits automatically: rejected in favor of review and revision fences.
