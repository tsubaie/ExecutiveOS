# 05 — UI guidelines

## Design system

- **Primitives:** shadcn/ui components generated on Base UI in `src/ui/primitives/`. Use them for buttons, inputs, selects, dialogs, sheets, popovers, tabs, tooltips, toasts, menus, and combobox. Hand-rolling any of these is an audit failure. Fixed-list choices go through `src/ui/layout/ChoiceSelect` (a Select up to ten options, a Combobox with a search box beyond that); calendar dates through `src/ui/layout/DatePicker` (quick picks and a month grid in a Popover). Generated primitive files are exempt from the size and prop-count lint rules.
- **Tokens:** `src/ui/tokens.css` defines every color, radius, shadow, and spacing scale as CSS variables under `@theme`. The dark values are Catppuccin Mocha (mantle ground, base surfaces, green accent); the light values are the house sage palette. Semantic names only: `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, plus the three-colour status scale (`--color-status-good|warn|bad` and their `-ink` variants) that a state is read in. Light and dark values are both defined; dark is the default.
- **No raw colors in TSX** (static lint `no-color-literals`). Status colors come from `tone()` helpers mapping an enum to a semantic class.
- **Typography:** Inter (Latin) and IBM Plex Sans Arabic via `next/font`. Both faces are always in the stack, ordered by `<html lang dir>` (Inter first in LTR, the Arabic face first in RTL), so mixed-script text renders each script in its own face; nothing is applied per element. Mixed-direction fields use `dir="auto"`; inline mixed runs are wrapped in `<bdi>` by the `Text` component so an English acronym inside an Arabic title does not flip punctuation.
- **Density:** base 16px (readable for a 40+ audience on tablets); list rows 44px single-line; form controls 36px with a pointer and 44px on touch (`pointer: coarse`), so hit areas never drop below 44px where fingers are used; 8px grid. Tinted surfaces for emphasis come from `--color-accent-soft`, `--color-warning-soft`, `--color-danger-soft`; the foreground on each is its matching solid token and both pairs meet 4.5:1 in both themes.
- **Icons:** Lucide only. Icon buttons have `aria-label` from i18n.
- **Theme:** `next-themes`, class attribute, pre-hydration script; per-user setting. Dialog and sheet backdrops use `--color-scrim`, a dark translucent ground in both themes.
- **Motion:** one deceleration curve (`--ease-rise`) and one cascade step (`--step-rise`), both in `tokens.css`. Entrances run 300-450 ms, state changes 120-220 ms; anything longer reads as a wait. Keyframes live in `tokens.css`, never in TSX, so a per-element delay is an `nth-child` step and not an inline style. Anything that animates on arrival uses `backwards` fill, so it is never painted at rest and then moved. Only `opacity`, `translate`, `scale` and colour are animated; never a property that reflows. Every animation and transition is switched off under `prefers-reduced-motion: reduce` and must leave the element at its resting appearance, which the home entrance test asserts.
- **Feedback:** a change the user caused says so. A count that changes is remounted on its own value so the new figure replaces the old (`count-tick`); a row that arrives rises in as the mirror of one that leaves (EP-B12); a control that appears in place uses `rise-in`; the save tick lands the way the completion tick does. None of these is a loop: motion in this app marks an event and stops.
- **Page transitions:** replacing one screen with another goes through `src/ui/layout/PageTransition.tsx` (ADR 0019), never through `ViewTransition` directly. One pair of names covers both a route change and a Suspense boundary resolving, because they are the same handoff. The transition is a crossfade with a short rise, not a directional slide: the destinations are siblings in one nav, so there is no forward or back to encode, and nothing needs an RTL mirror.

## Layout shell

```
AppShell
├── Sidebar (≥ 1024px)        nav from src/ui/layout/nav.ts
├── TopBar                    page title, breadcrumbs, search, user menu
├── <main>
└── BottomNav (< 1024px)      Home · Tasks · Meetings · Notes · Menu
```

- One navigation definition (`nav.ts`) renders both Sidebar and BottomNav. Modules disabled in settings are absent from both.
- The shell owns the viewport at every width: it is exactly one screen tall, the header, rail and bottom bar hold their size, and `<main>` is the scrolling element — reserving the bottom bar's height as padding rather than running under it. A page that fills the screen therefore measures nothing itself; writing those heights into a page's own `calc()` is what left a strip of empty ground under the workspace on a desktop and a control beneath the navigation bar on a phone.
- Scrollbars are styled once, in `tokens.css`, for every scrolling element: a thin bar with no track and a rounded thumb in `--border` that darkens to `--muted-text` under the pointer. `color-scheme` still hands the platform its matching default, so a bar that cannot be styled is the right colour anyway.
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

- `recharts` wrapped once in `src/ui/charts/` (TrendChart, Gauge). Modules use wrappers only, and the wrappers are the only importers of the library (dependency-cruiser `chart-library-only-in-wrappers`). A mark small enough to sit inside a list row is drawn directly in SVG and lives beside them rather than coming from the library: a charting runtime per row costs more than the rest of the page, and it would pull the library into a list route that has no axis, tooltip or legend to show. The library loads with the record panel that needs it. `MeterArc` in `src/ui/layout` is the standing example — the scorecard's tiles each carry one (KPIS-B07). Colours come from `src/ui/charts/tokens.ts`, which resolves theme variables at paint time so a chart follows the theme switch without re-rendering; no chart file carries a literal. A proportion inside a row is the `Meter` in `src/ui/layout`, not a chart.
- Marks are thin and the chrome is recessive: 2px lines with round joins, markers at least 8px with a 2px surface ring, columns capped at 22px and rounded only at the end away from the baseline, gridlines a solid hairline one step off the surface, never dashed. A dash is reserved for a reference series, where it means "threshold".
- **Status scale.** `--status-good`, `--status-warn`, `--status-bad` are the three colours a state is read in, with `-ink` variants for the same hue as text. Marks take the scale, words take the ink: a mark needs 3:1 and a word needs 4.5:1, and the two are not always the same step. The scale is separate from `--success`/`--warning`/`--danger`, which carry the app's own semantics (a late task, a destructive action); a featured view's `tone` may name either.
- Two or more series always carry a legend, written in HTML beside the plot rather than drawn by the library, so identity survives translation, the text tokens and a screen reader. Text never wears a series colour; the colour sits on the mark next to the words. One series needs no legend: the heading already names it.
- Never a second value axis. Two measures of different scale are two charts.
- Every chart ships the same figures as a visually hidden table (`ChartTable`). The hiding goes on a wrapper around the table, never on the table itself: a table treats the `sr-only` width as a suggestion and still lays out at its content's width, so one long unbroken word in a caption pushes the document wider than the screen — which in RTL slides the page sideways rather than merely adding a scrollbar. A chart small enough to sit inside a list row carries a spoken summary instead, because a hidden table per row would drown the rows it belongs to, and every figure it draws is already written in the row.

## Copy and tone

Sentence case; no exclamation marks; empty states name the purpose and offer the primary action; relative times in lists, absolute in detail.
