# ADR 0004 — shadcn/ui on Base UI with semantic tokens as the design system

**Status:** accepted (2026-09-07)

## Context

The predecessor had shadcn installed but unused, hand-rolled every dialog and menu without accessibility, mimicked a third-party admin theme pixel by pixel, and accumulated 251 hard-coded hex values and two competing token sets. RTL was font-only. For an open-source product used in Arabic and English, accessibility and direction-awareness must be defaults, not retrofits.

## Decision

- Primitives come from shadcn/ui generated on Base UI into `src/ui/primitives`. They are the only source of dialogs, sheets, menus, selects, tabs, tooltips, and toasts.
- A single semantic token set in `src/ui/tokens.css` (light and dark). Lint forbids color literals and palette classes in TSX.
- Tailwind logical utilities only; lint forbids physical direction utilities.
- Charts through `src/ui/charts` wrappers over one library (`recharts`, to be confirmed by a separate ADR if changed).
- The visual style is ours (compact, dark-first, executive), expressed through tokens, not by copying a theme.

## Consequences

- Accessibility (focus traps, roles, keyboard) comes from the primitives; audits verify with axe.
- Designers and agents change the look by editing tokens, not components.
- Custom visual components (bands, gauges, progress bars) still need explicit a11y work and are listed in the module audits.
- Lint rules require custom ESLint plugins in `tools/eslint/`; they are part of Phase 1.

## Alternatives considered

- **Continue hand-rolled Tailwind**: fastest to start, but repeats the accessibility debt.
- **A full component framework (MUI, Mantine)**: heavier bundles and harder to keep the compact executive density.
- **Radix-based shadcn**: fine, but Base UI is the current shadcn default and has better RTL and form primitives.
