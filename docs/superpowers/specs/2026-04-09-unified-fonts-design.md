# Spec C — Unified Font System + Google Fonts in Playground

**Date:** 2026-04-09
**Status:** Approved (pending user review of written spec)
**Author:** brainstorming session
**Part of:** 3-spec sequence (A → B → C) for playground improvements
**Builds on:** Spec A (polish) and Spec B (app shell), both shipped

## Context

OG Engine currently has two font systems:

1. **Playground (browser, `docs/site/src/components/engine/fonts.ts`)** — 8 hardcoded `FontEntry` records, each with a Google Fonts CSS URL loaded at runtime.
2. **API server (root `src/engine/fonts.ts`)** — the same 8 fonts, hardcoded again, but pointing to local `.ttf` files registered with `@napi-rs/canvas` `GlobalFonts.registerFromPath()`.

This creates two friction points:

- The 8 fonts are duplicated in two places. Adding a font requires editing both files and downloading the binary.
- Users can only ever pick from those 8. Designers expect to find Roboto, Open Sans, Bebas Neue, Bricolage Grotesque — the playground feels limited.

Spec C unifies the two systems behind a single canonical catalog file, ships ~50 curated fonts physically inside the API server, and replaces the playground's 8-pill picker with a searchable virtualized combobox showing all ~1,800 Google Fonts. Non-curated fonts are clearly marked "Preview only — not yet API supported" and trigger a warning banner inside the code output drawer when selected.

## Goals

1. Single source of truth for the curated font catalog used by both API server and playground.
2. Curated 50 fonts physically downloaded and registered with the API server (zero regressions for existing playground users; expanded coverage for future users).
3. All ~1,800 Google Fonts surfaced in the playground combobox with clear "API ready" vs "Preview only" labeling.
4. Searchable, virtualized combobox UX with category filters, recents, and per-row in-font preview.
5. Honest communication of the API gap via a warning banner in the code drawer when a Preview-only font is selected.

## Non-Goals (deferred)

- API-side lazy font registration (downloading any Google Font on demand at the API server). Explicitly rejected: increases complexity, abuse surface, and cold-start latency.
- Variable font axis controls (weight/width/slant sliders).
- Font pairing suggestions ("usually paired with…").
- BYO-font upload (user-supplied font files).
- Replacing the existing weight Slider UI.

## Architecture

### 1. Canonical catalog file

**Location:** `src/engine/font-catalog.ts`

A single TypeScript module that defines:

```ts
export interface CuratedFontEntry {
  name: string;            // 'Outfit' — what users see in the picker
  family: string;          // 'Outfit' — CSS font-family value
  slug: string;            // 'outfit' — directory name under /fonts/
  weights: number[];       // [400, 700, 800]
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  subsets: string[];       // ['latin'] or ['latin', 'cjk'] etc.
}

export const CURATED_FONTS: CuratedFontEntry[];

export function isCuratedFont(name: string): boolean;
```

Both the existing API-server `src/engine/fonts.ts` and the playground client `docs/site/src/components/engine/fonts.ts` are rewritten as thin wrappers that import `CURATED_FONTS` from this canonical file. Each side adds its environment-specific behavior (API server registers TTF paths; playground client loads Google CSS) without re-declaring the catalog.

### 2. Full Google Fonts catalog dump

**Location:** `src/data/google-fonts.json`

A static JSON file containing ~1,800 entries, generated once from the public `gwfh.mranftl.com/api/fonts` mirror and committed to git. Shape (a subset of the upstream API):

```json
[
  {
    "family": "Roboto",
    "category": "sans-serif",
    "subsets": ["latin", "cyrillic", "greek"],
    "variants": ["regular", "700", "italic"]
  },
  ...
]
```

This file is the source of truth for the playground combobox's "all Google Fonts" view. It is NOT used by the API server.

### 3. Refresh script

**Location:** `scripts/refresh-google-fonts.ts`

A one-shot script run manually (not in CI). Fetches the latest Google Fonts catalog from `gwfh.mranftl.com/api/fonts`, transforms to the shape above, writes `src/data/google-fonts.json`. Run quarterly. If the public mirror is unreachable, the script logs an error and exits non-zero — the existing JSON file is unchanged.

### 4. Curated 50 fonts

The list:

| Category | Fonts |
|---|---|
| Sans-serif (22) | Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Outfit, Sora, Space Grotesk, DM Sans, Manrope, Plus Jakarta Sans, Figtree, Work Sans, Nunito, Nunito Sans, Source Sans 3, Karla, Rubik, Mulish, Onest, Albert Sans |
| Serif (10) | Playfair Display, Merriweather, Lora, Crimson Pro, EB Garamond, Cormorant Garamond, Source Serif 4, PT Serif, Bitter, Spectral |
| Display (9) | Bebas Neue, Anton, Oswald, Archivo Black, Fraunces, Syne, Unbounded, Bricolage Grotesque, Familjen Grotesk |
| Monospace (5) | JetBrains Mono, Fira Code, IBM Plex Mono, Geist Mono, Space Mono |
| Handwriting (3) | Caveat, Kalam, Pacifico |
| CJK + Arabic (4) | Noto Sans JP, Noto Sans Arabic, Noto Sans SC, Noto Sans KR |

Total: 53 (the spec calls it "the curated 50" — the slight overshoot is fine; we round to "the curated set" in implementation). The 8 fonts currently shipped (Outfit, Inter, Playfair Display, Sora, Space Grotesk, JetBrains Mono, Noto Sans JP, Noto Sans Arabic) are all included → zero regression.

Each curated font ships with at least weights `[400, 700]`. Display fonts that have a single weight ship that one. Variable fonts are treated as static-weight `400 / 700`.

### 5. Curated font download script

**Location:** `scripts/download-curated-fonts.ts`

Run via `bun run fonts:download` from the repo root. Reads `CURATED_FONTS` from `font-catalog.ts`, iterates each entry × each weight, downloads the WOFF2 from Google Fonts CSS API (using the same User-Agent trick as the existing `docs/site/scripts/download-fonts.ts`), and writes to `fonts/<slug>/<slug>-<weight-name>.woff2`. Idempotent — skips files that already exist on disk. Logs progress.

After running, the API server's `src/engine/fonts.ts` registration loop picks up all the new files automatically (no code change needed beyond the catalog import).

### 6. FontCombobox component

**Location:** `docs/site/src/components/ui/FontCombobox.tsx`

A new React component replacing the current `<FontPicker>` (which renders 8 pill buttons).

**Trigger button:** the currently-selected font name rendered in its own family. Click toggles the dropdown. Includes an `aria-haspopup="listbox"` and a small chevron icon.

**Dropdown panel:** `position: absolute` below the trigger on desktop, `position: fixed` bottom-sheet on mobile. Max height `60vh` desktop, `80vh` mobile. Closes on outside click, Escape, or selection.

**Search input:** auto-focused on open. Filters by family-name substring (case-insensitive). The `/` key from the document body opens the dropdown and focuses the search input.

**Filter chips:** `All · Sans · Serif · Display · Mono · Handwriting · CJK · Arabic`. Multi-select OR semantics within categories, AND with the search query.

**List sections (in order):**

1. **Recent** — last 5 picked fonts from `localStorage.getItem('pg-recent-fonts')`. Hidden if empty. No section header if empty.
2. **API ready** — the curated 50, sorted alphabetically. Each row renders the family name in its own font. No badge.
3. **Preview only** — the remaining ~1,750 fonts, sorted alphabetically. Each row renders the family name in its own font (lazy-loaded on scroll into view). Each row has a small `Preview only` badge to the right.

**Virtualization:** hand-rolled simple windowing using a `ref` on the scroll container, `getBoundingClientRect`, and `IntersectionObserver`. Only render rows that are within the viewport ± 10 rows of overscan. No external library — keeps the dependency footprint at zero. (Spec acknowledges this is more code than `react-window`; the trade-off is one less dependency and full control over the row markup.)

**Lazy CSS loading:** when a row enters the viewport, append a `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap">` to `<head>` if not already loaded. Track loaded fonts in a module-level `Set<string>`. When the user selects a font, the same loader runs synchronously to ensure the canvas re-render uses the correct font.

**Keyboard navigation:**
- `↑` / `↓` move the highlighted row
- `Enter` selects the highlighted row
- `Escape` closes the dropdown
- `/` from page body opens the dropdown and focuses search
- `Tab` from search input moves focus to the first filter chip; subsequent Tab/Shift-Tab cycles chips and rows

**Empty state:** "No fonts match `<query>`" with a hint about category filters.

**Selection:**
1. Sets the active font in Playground state
2. Prepends the font name to `pg-recent-fonts` localStorage (deduplicated, capped at 5)
3. Closes the dropdown
4. Triggers the playground re-render

### 7. Preview-only warning banner

When the active font is NOT in `CURATED_FONTS`, the `CodeOutput` component (inside the `CodeDrawer` from Spec B) renders a warning banner above the curl/SDK/JSON tabs:

```
⚠ "Bebas Neue" is preview-only — the API server doesn't have this font yet.
   Pick an "API ready" font, or see the supported list at /fonts/available-fonts/.
```

The banner uses `--pg-text-secondary` for body text and the `accent` color for the link. Click → opens `/fonts/available-fonts/` in a new tab.

The warning does not prevent code generation — users can still copy the curl/SDK example. They just see a clear signal that the example will fail at the API.

### 8. /fonts/available-fonts/ page update

**Location:** `docs/site/src/content/docs/fonts/available-fonts.mdx`

The current page lists 8 fonts statically. Update it to import `CURATED_FONTS` from `font-catalog.ts` and render an alphabetical table of all 50, grouped by category. This keeps the documentation in sync with the code automatically — no more "8 fonts in the docs but the API has more / fewer".

### 9. Documentation: how unified fonts work

A short section added to the existing `docs/site/src/content/docs/fonts/available-fonts.mdx` (or a new sibling page) explaining:
- The curated 50 are server-side ready
- The playground also supports preview of any Google Font
- How to request a font be added to the curated list (link to GitHub issues)

## Files Touched (provisional)

| # | File | Type | Notes |
|---|---|---|---|
| 1 | `src/engine/font-catalog.ts` | NEW | canonical catalog + helpers |
| 2 | `src/data/google-fonts.json` | NEW | static dump (~200KB) |
| 3 | `src/engine/fonts.ts` | rewrite | imports CURATED_FONTS, no hardcoded list |
| 4 | `docs/site/src/components/engine/fonts.ts` | rewrite | imports CURATED_FONTS, no hardcoded list |
| 5 | `docs/site/src/components/ui/FontCombobox.tsx` | NEW | searchable combobox |
| 6 | `docs/site/src/components/ui/StyleControls.tsx` | modify | replace `<FontPicker>` with `<FontCombobox>`, delete `FontPicker` function |
| 7 | `docs/site/src/components/Playground.tsx` | modify | wire CodeDrawer warning |
| 8 | `docs/site/src/components/ui/CodeOutput.tsx` | modify | render warning banner when font is preview-only |
| 9 | `scripts/refresh-google-fonts.ts` | NEW | manual refresh script |
| 10 | `scripts/download-curated-fonts.ts` | NEW | download all curated fonts to /fonts/ |
| 11 | `package.json` (root) | modify | add `fonts:download` and `fonts:refresh-catalog` scripts |
| 12 | `fonts/` (binary) | NEW files | ~42 new font directories, ~80 WOFF2 files, ~15-25 MB total |
| 13 | `docs/site/src/content/docs/fonts/available-fonts.mdx` | rewrite | auto-generated table from font-catalog.ts |

The implementation plan will verify exact paths and may add or remove files based on what Bun/Astro tooling allows.

## Testing Approach

### Unit
- `font-catalog.ts`: `CURATED_FONTS` length is 50+; every entry has the required fields; `isCuratedFont('Inter')` returns true; `isCuratedFont('Comic Sans MS')` returns false.

### API server smoke test
- Start the server: `bun run dev` from repo root
- For each of the 50 curated names: `POST /render` with that name as the font, expect HTTP 200 and a valid PNG body
- `POST /render` with `font: "Roboto Mono"` (a known non-curated mono) returns a clear 4xx error message naming the unsupported font

### Playground smoke test (manual via dev server + Chrome MCP)
- Open `/playground/`. Confirm the FontCombobox replaces the 8 pills.
- Open the dropdown. Confirm sections render: Recent (empty), API ready (50), Preview only (~1,750).
- Search "Bebas". Confirm "Bebas Neue" appears in API ready. Search "Cinzel". Confirm it appears in Preview only.
- Filter by Mono. Confirm only mono fonts are shown.
- Select Bebas Neue. Confirm:
  - The preview re-renders with the new font
  - "Bebas Neue" appears in the trigger button rendered in its own font
  - Recent now contains Bebas Neue
- Select Cinzel (a Preview-only font). Confirm:
  - Preview re-renders correctly (browser CSS load)
  - Open the CodeDrawer (View code)
  - Confirm the warning banner appears with the Cinzel font name
- Reload the page. Confirm Recent persists.

### No regressions
- All 8 existing presets still render with the same fonts after Spec C (since all 8 are in CURATED_FONTS)
- All Spec A and Spec B behaviors still work: contrast, sticky Surprise me, R shortcut, drawer, sidebar
- `bun run build` from `docs/site` passes
- Pre-commit hooks pass

### Manual verification
- Run `bun run fonts:download` from repo root. Confirm all 50 fonts land in `/fonts/<slug>/`. Confirm WOFF2 files are well-formed (open one in a browser).

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Repo size grows by 15-25 MB | Acceptable: WOFF2 is small, the tradeoff buys runtime correctness. If size becomes a deploy concern later, move `/fonts/` to a release artifact pulled at API container startup. |
| docs/site cannot import from `../../src/engine/font-catalog.ts` due to tsconfig rootDir restrictions | Verify during planning. Fallback: a `prebuild` script in docs/site copies the canonical file into `docs/site/src/data/font-catalog.ts` so the import is local. The canonical source remains the root file. |
| Public mirror gwfh.mranftl.com goes down before refresh | Refresh script is manual, not in CI. Build never depends on network availability. The committed JSON file is always current enough. |
| 1,800 rows crash the DOM | Hand-rolled virtualization renders only ~30 visible rows + overscan. Test on a low-end device. If this is too risky, swap in `react-window` (acceptable single-purpose dependency). |
| Lazy CSS loading hammers Google Fonts CDN | Loaded fonts are tracked in a module-level Set; each font is loaded at most once. Cap concurrent loads to 10 via a simple queue. |
| Variable font support is different from per-weight | Treat all fonts as static-weight 400 / 700. Variable fonts are deferred. The download script always requests the static `:wght@400` and `:wght@700` URLs. |
| The 50 curated fonts include some I (the user) don't like | Edit the list before approving the spec; the curated set is a one-line edit to the catalog file. |
| `FontPicker` references in the codebase beyond StyleControls | Grep before deletion; rewrite call sites to `FontCombobox`. |
| Existing 8 hardcoded fonts have name/slug mismatches with what the catalog declares | Manually verify each of the 8 against the new catalog during implementation. The 8 currently-shipped names are: Outfit, Inter, Playfair Display, Sora, Space Grotesk, JetBrains Mono, Noto Sans JP, Noto Sans Arabic. |

## Acceptance Criteria

- [ ] `src/engine/font-catalog.ts` exists and exports `CURATED_FONTS` (>= 50 entries) and `isCuratedFont()`
- [ ] `src/engine/fonts.ts` imports its registration list from `font-catalog.ts` — no hardcoded duplicates remain
- [ ] `docs/site/src/components/engine/fonts.ts` imports from `font-catalog.ts` — no hardcoded duplicates remain
- [ ] `src/data/google-fonts.json` exists with at least 1,500 entries
- [ ] `scripts/refresh-google-fonts.ts` and `scripts/download-curated-fonts.ts` exist and work
- [ ] `bun run fonts:download` (from repo root) downloads all curated fonts to `/fonts/`
- [ ] All 50 curated fonts physically exist under `/fonts/<slug>/<slug>-<weight>.woff2` after the script runs
- [ ] Playground replaces the 8 font pills with `<FontCombobox>` showing all ~1,800 fonts
- [ ] Combobox supports: search, filter chips, virtualized list, lazy CSS loading, recents, keyboard navigation
- [ ] Selecting a Preview-only font shows a warning banner in the CodeOutput drawer
- [ ] Selecting a curated font shows no banner
- [ ] All 8 existing presets still render with the correct fonts (zero visual regression)
- [ ] API server returns valid renders for all 50 curated font names
- [ ] API server returns a clear error for non-curated font names
- [ ] `available-fonts.mdx` reflects the catalog automatically
- [ ] No console errors introduced
- [ ] All Spec A and Spec B behaviors still work

## Out of Scope (explicit reminders)

- API-side lazy font registration → rejected
- Variable font axes → deferred
- Font pairing suggestions → not planned
- BYO font upload → not planned
- Replacing the existing weight Slider UI → not planned
