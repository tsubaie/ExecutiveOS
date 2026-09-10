# ADR 0015 — Markdown rendering with react-markdown and a sanitizing schema

**Status:** accepted (2026-09-10)

## Context

Notes content, task descriptions, AI-refined notes, briefs and learnings are markdown. The coding guidelines forbid `dangerouslySetInnerHTML` and require every markdown render to go through `src/ui/markdown`; the AI guidelines require remote images disabled and `http(s)` links only. The ADR index listed the markdown editor component as an open decision. The editor question is settled separately: v1 edits markdown in a plain textarea with a preview toggle; a rich editor is not in scope.

## Decision

- One renderer: `react-markdown` with `remark-gfm` for tables, task lists and strikethrough, and `rehype-sanitize` with a project schema. Output is React elements; no HTML string is ever injected.
- The schema in `src/ui/markdown/schema.ts` starts from the library default and removes `img` entirely, allows `a[href]` only for `http:`, `https:` and `mailto:`, strips `style`, `class` and `id` attributes, and forces `rel="noopener noreferrer"` and `target="_blank"` on links through a component override.
- `src/ui/markdown/Markdown.tsx` is the only importer of these packages (dependency-cruiser rule). It sets `dir="auto"` on block containers so mixed Arabic and English content lays out per paragraph.
- The editor is `src/ui/markdown/MarkdownField.tsx`: a textarea and a Write / Preview toggle that renders through the same component.

## Consequences

- Three runtime dependencies (`react-markdown`, `remark-gfm`, `rehype-sanitize`) counted once against the "one markdown renderer" rule.
- Bundle: the renderer is loaded only on routes that render markdown; the route budget audit applies.
- A future rich editor would produce markdown and render through the same component.

## Alternatives considered

- `marked` plus `DOMPurify`: smaller and faster, but produces an HTML string and needs `dangerouslySetInnerHTML`, which the guidelines forbid.
- `markdown-it`: same HTML-string shape.
- A rich editor now (TipTap or similar): a large dependency, RTL work and a separate ADR; the maintainer chose the textarea for v1.
