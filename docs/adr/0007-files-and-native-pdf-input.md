# ADR 0007 — Local file storage and native PDF input for meeting briefs

**Status:** accepted (2026-09-07)

## Context

Meeting Prep is in v1 and must run without a worker or CLI. The predecessor watched a Google Drive folder from a host process, extracted text with `pdftotext` and `mammoth`, and piped text to a CLI. The rewrite needs uploads, storage, and analysis inside the app.

## Decision

- Files are uploaded through the app and stored on a local directory (`FILES_DIR`, a Docker volume) under content-addressed, date-partitioned keys, with metadata in the `files` table. No external object storage in v1; the storage module exposes a small interface (`put`, `getStream`, `delete`, `resolveInside`) so S3-compatible storage can be added later without touching modules.
- PDFs are sent to the model as native document content blocks (base64), which preserves layout, tables, and page references and removes the text-extraction dependency for the main path. Extracted text is still produced for search and as a fallback for non-PDF inputs.
- DOCX is converted in-process (`mammoth` to HTML → text; PDF conversion via a pure-JS path where available); PPTX and XLSX are out of scope until a pure-JS converter is chosen.
- Size limits follow the API's document limits (32 MB, 600 pages); larger documents are refused at upload with a clear message.

## Consequences

- Self-hosters need only a volume; backups must include `FILES_DIR` (the backup job tars it alongside the dump).
- Large base64 payloads mean brief jobs stream responses and run with concurrency 1 by default for that kind.
- File streaming routes must enforce sessions and path containment; the security audit checks both.

## Alternatives considered

- **Keep folder watching**: host-specific and incompatible with containers.
- **S3 in v1**: adds setup burden for self-hosters; deferred behind the storage interface.
- **Text-only prompts**: cheaper but loses page references and tables that the brief relies on.
