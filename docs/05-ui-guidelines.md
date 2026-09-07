# 05 — UI guidelines

## Design system

- **Primitives:** shadcn/ui components generated on Base UI in `src/ui/primitives/`. Use them for buttons, inputs, selects, dialogs, sheets, popovers, tabs, tooltips, toasts, menus, and combobox. Hand-rolling any of these is an audit failure. Fixed-list choices go through `src/ui/layout/ChoiceSelect` (a Select up to ten options, a Combobox with a search box beyond that); calendar dates through `src/ui/layout/DatePicker` (quick picks and a month grid in a Popover). Generated primitive files are exempt from the size and prop-count lint rules.
- **Tokens:** `src/ui/tokens.css` defines every color, radius, shadow, and spacing scale as CSS variables under `@theme`. The dark values are Catppuccin Mocha (mantle ground, base surfaces, green accent); the light values are the house sage palette. Semantic names only: `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`. Light and dark values are both defined; dark is the default.
- **No raw colors in TSX** (static lint `no-color-literals`). Status colors come from `tone()` helpers mapping an enum to a semantic class.
- **Typography:** Inter (Latin) and IBM Plex Sans Arabic via `next/font`. Both faces are always in the stack, ordered by `<html lang dir>` (Inter first in LTR, the Arabic face first in RTL), so mixed-script text renders each script in its own face; nothing is applied per element. Mixed-direction fields use `dir="auto"`; inline mixed runs are wrapped in `<bdi>` by the `Text` component so an English acronym inside an Arabic title does not flip punctuation.
- **Density:** base 16px (readable for a 40+ audience on tablets); list rows 44px single-line; form controls 36px with a pointer and 44px on touch (`pointer: coarse`), so hit areas never drop below 44px where fingers are used; 8px grid. Tinted surfaces for emphasis come from `--color-accent-soft`, `--color-warning-soft`, `--color-danger-soft`; the foreground on each is its matching solid token and both pairs meet 4.5:1 in both themes.
- **Icons:** Lucide only. Icon buttons have `aria-label` from i18n.
- **Theme:** `next-themes`, class attribute, pre-hydration script; per-user setting. Dialog and sheet backdrops use `--color-scrim`, a dark translucent ground in both themes.

## Layout shell

```
AppShell
├── Sidebar (≥ 1024px)        nav from src/ui/layout/nav.ts
├── TopBar                    page title, breadcrumbs, search, user menu
├── <main>
└── BottomNav (< 1024px)      Home · Tasks · Meetings · Notes · Menu
```

- One navigation definition (`nav.ts`) renders both Sidebar and BottomNav. Modules disabled in settings are absent from both.
- Every page has `loading.tsx` and `error.tsx`. Placeholder pages are forbidden.
- Home is specified in `features/home.md`.

## Entity page framework

All list + detail modules use `src/ui/entity` per `features/entity-pages.md`. Pages provide filters, hooks, mutation adapters, and renderers. They MUST NOT re-implement selection, URL sync, keyboard navigation, mobile transitions, multiselect, or auto-save.

## Data fetching and mutations

- Server state through TanStack Query hooks in `modules/<m>/ui/queries.ts`. Query keys: `[module, "list", filters, locale?]`, `[module, "detail", id, locale?]`, `[module, "counts", filters]`, `["links", type, id]`, `["jobs", id]`. Keys are scoped by user id at the client level (`QueryClient` is recreated on login and logout).
- Mutations use `useMutation` with optimistic updates for inline edits and invalidate the keys listed in the spec's dependency map on settle. A mutation never invalidates fewer keys than the spec lists.
- Every mutation sends an `Idempotency-Key`; the Retry action in a failure toast reuses it.
- Auto-save (`useAutoSave`) serializes per entity: one request in flight, the newest pending edit coalesces earlier ones, and on 409 the local draft is kept and a "Reload and reapply" action is offered.
- Lists refetch on window focus and every 60 seconds while visible so other members' edits appear; there is no real-time channel.
- Job-backed actions poll `["jobs", id]` every 2 seconds while `queued` or `running` (max 10 minutes), then invalidate the spec's keys.

## Forms

- `react-hook-form` + `zodResolver` with the module's validation schema (`schema/validation.ts`, client-safe).
- Field errors under fields; server `fieldErrors` with dotted paths map to nested fields.
- Dropdowns save immediately in edit mode; nothing persists in create mode until submit.
- Destructive actions require a confirm dialog naming the entity.

## Mobile

- Safe areas on shell, bottom nav, sheets. Touch targets ≥ 44px. No hover-only affordances.
- Bottom sheets for pickers on touch; popovers on desktop; one picker component chooses by pointer type, not width.
- Pull-to-refresh via `refetch`.
- PWA manifest and icons; service worker caches the app shell only and excludes `/api/` and file downloads (`Cache-Control: no-store` respected). No push in v1.

## Internationalization and RTL

- `next-intl`; catalogs `en.json`, `ar.json`. Every user-visible string goes through `t()`. Translation keys are typed (generated `MessageKeys` type); dynamic keys (`t(value)` for enum labels) stay typed through `next-intl`; the i18n audit resolves literal keys and reports dynamic ones per file. ICU plurals and arguments validated by the audit.
- Locale precedence: `user.locale` → `workspace.default_locale`. Timezone precedence: `user.timezone` → `workspace.timezone`. Both are part of `ctx` on the server and of the query keys where relevant.
- Calendar: Gregorian only in v1. Numerals: `user.numerals` → `workspace.arabic_numerals` (Western by default), applied through `next-intl` named formats set in `core/i18n/request.ts`. Components render dates and counts only through `src/ui/format.ts` (`usePlainDate`, `useDateTime`, `useCount`); plain `date` strings are split into year, month and day and rendered at UTC, never parsed with `new Date("YYYY-MM-DD")`.
- Direction-agnostic layout: logical utilities only (static lint). Directional icons flip with `rtl:rotate-180`. Slide animations and column order derive from `dir`.
- Charts in RTL: time axes run right to left, legends and labels use logical alignment; the chart wrapper handles it and has an RTL snapshot test of the SVG structure.
- Mixed direction: list rows and inputs use `dir="auto"`; the detail title uses `dir="auto"` and `unicode-bidi: plaintext`.
- RTL verification is behavioral: e2e runs every golden path in `ar`, asserts `dir="rtl"` on `html`, and measures overflow (`scrollWidth <= clientWidth`) and visible focus ring bounds at 320 px and 390 px widths.

## Accessibility

- Dialogs, sheets, and menus come from primitives; composed screens still declare labels and headings, and e2e checks keyboard reachability of every action on the golden paths.
- Interactive elements are buttons, links, or form controls (static lint). Lists are keyboard navigable per the entity framework.
- Charts render an adjacent accessible table (visually hidden) with the same data.
- Contrast ≥ 4.5:1 text, ≥ 3:1 UI; axe runs on every route in both locales in the a11y audit with zero serious or critical findings.
- Pinch zoom is not disabled. Skip link on every page.

## Charts

- `recharts` wrapped once in `src/ui/charts/` (Sparkline, TrendChart, Gauge, ProgressBar). Modules use wrappers only. Colors from tokens; both themes; RTL-aware.

## Copy and tone

Sentence case; no exclamation marks; empty states name the purpose and offer the primary action; relative times in lists, absolute in detail.
