# Spec A — Playground Polish

**Date:** 2026-04-09
**Status:** Approved (pending user review of written spec)
**Author:** brainstorming session
**Part of:** 3-spec sequence (A → B → C) for playground improvements

## Context

The OG Engine playground at `/playground/` is the product's most important conversion surface, but a Chrome DevTools audit of the live site surfaced several friction points:

- The right-hand table-of-contents column shows only "Overview" because `playground.mdx` has no headings — pure dead space that compresses the rest of the layout.
- Multiple WCAG 2.1 AA contrast failures on form labels, placeholders, inactive code-format tabs, and preset card sublabels.
- The "Randomize" button is small and tucked top-right of the preset section, even though it produces the strongest "wow" interaction in the product.
- The sidebar buries the highest-engagement pages (Playground, Templates, Benchmarks, Pricing) below docs.
- The Auto-fit text checkbox lives at the bottom of the form, far from the title-size slider that would prompt a user to look for it.

This spec ships the low-risk, high-leverage subset of fixes. Larger changes (custom layout for the playground, Google Fonts integration) are deferred to Specs B and C respectively.

## Goals

1. Eliminate WCAG AA contrast failures in the playground UI.
2. Recover horizontal space currently wasted on a single-item TOC.
3. Surface the highest-conversion pages in the global sidebar.
4. Promote the Randomize interaction to its rightful prominence.
5. Place the Auto-fit toggle where users will actually look for it.

## Non-Goals (deferred)

- Layout/canvas size changes — handled in Spec B.
- Custom Astro layout for `/playground/` — handled in Spec B.
- Font picker rework / Google Fonts catalog — handled in Spec C.
- URL state, side-by-side previews, fork-as-React export — deferred indefinitely (YAGNI until Specs B/C are validated).

## Changes

### A1. Sidebar reorder

**File:** `docs/site/astro.config.mjs`

The sidebar currently lists pages in roughly historical order. Reorder to put high-engagement pages at the top, group reference material, and surface Pricing.

New order:

```
Home
Playground             [badge: "Try it"]
Templates Gallery
Benchmarks
Quick Start
Guides             ▸
API Reference      ▸
SDK                ▸
Resources          ▸   (NEW group)
   Available Fonts
   OG Engine vs Puppeteer
   Self-Hosting (Docker)
Pricing
Changelog
Blog               ▸
```

Implementation notes:
- Dissolve the existing single-child `Compare` group; its sole entry moves into `Resources`.
- Move `Available Fonts` and `Self-Hosting (Docker)` from root into `Resources`.
- Add Starlight `badge` prop `{ text: 'Try it', variant: 'success' }` to the Playground entry.

### A2. Hide TOC on `/playground/`

**File:** `docs/site/src/content/docs/playground.mdx`

Add `tableOfContents: false` to the frontmatter. The page has no headings, so the TOC shows only an auto-generated "Overview" item that occupies a full sidebar column for no information value.

This single change recovers ~280px of horizontal space at desktop breakpoints.

### A3. Contrast fixes

**Primary file:** `docs/site/src/components/playground.css`
**Secondary:** `docs/site/src/styles/custom.css` (only if Starlight token overrides are needed)

Replace each failing color with a value that clears WCAG AA (4.5:1 minimum for body text). All measurements are against the playground's `#050810`-ish background.

| Element | Current | Computed ratio | New value | Notes |
|---|---|---|---|---|
| Section labels (`TAG`, `TITLE`, `AUTHOR`, slider labels) | `rgb(71, 85, 105)` (slate-600) | 2.64 | `#94a3b8` (slate-400) | ~7:1 |
| Search input placeholder + `⌘K` hint | `rgb(148, 161, 181)` | 2.62 | `#94a3b8` (slate-400) | |
| Fullscreen `⛶` button | `rgb(148, 163, 184)` | 2.56 | `#cbd5e1` (slate-300) | Icon-only buttons need stronger contrast |
| Inactive `curl / SDK / JSON` tabs | green-500 on `rgba(255,255,255,0.02)` | 1.52 | `#cbd5e1` (slate-300) | Reserve accent green for the active tab only |
| Preset card sublabels (`Launch Day`, `Deep Dive`, etc.) | `#fff` on `rgba(255,255,255,0.02)` | ~1.0 | sublabel `#94a3b8`; bump card bg to `rgba(255,255,255,0.05)` and border to `rgba(255,255,255,0.10)` | The sublabel is currently invisible due to near-transparent background |
| `Download PNG` button | reported text-on-bg ~1.0 by walker | needs verification | confirm bg is solid `--accent` and text is `#06080c` | Walker may have walked past a transparent ancestor; verify with explicit `background-color` rule |

Add a CSS custom property `--pg-text-secondary: #94a3b8;` and a comment block at the top of `playground.css` documenting that any new "secondary text" element should use this token. This prevents future regressions.

Verification: re-run the contrast scan via Chrome DevTools after the change; every element above must clear 4.5:1.

### A4. Randomize CTA promotion

**File:** `docs/site/src/components/Playground.tsx` (and the relevant child component for the Quick Start section — verify exact path during implementation; likely `ui/Presets.tsx` based on filename inventory)

Current state: a small `Randomize` button sits in the top-right corner of the "Quick Start" section header.

Target state:
- Replace it with a **full-width** button placed **above** the four preset cards.
- Label: `🎲 Surprise me` with a `kbd`-styled `R` hint at the right edge (`Press R`).
- Subtle hover treatment: `scale(1.01)` + accent-colored box-shadow glow.
- Wire a global keyboard shortcut: pressing `R` (case-insensitive, no modifiers) triggers the same action, scoped to `document.body` and skipped when an `input`/`textarea`/`contenteditable` element is focused.
- Keep the four preset cards immediately below as the alternative "starting points" entry.

### A5. Auto-fit inline placement

**File:** the form component containing the Title size slider — likely `docs/site/src/components/ui/StyleControls.tsx` (verify during implementation).

Current state: an `Auto-fit text` checkbox sits at the bottom of the form, after the "Fine-tuning" section. Its description (`Shrinks title size automatically to prevent overflow`) is permanent helper text.

Target state:
- Move the checkbox up to sit immediately to the right of the **Title size** slider's label (`TITLE SIZE        Auto-fit ▢`).
- Remove the original checkbox from the Fine-tuning section. If Fine-tuning becomes empty as a result, remove the section header too.
- Convert the description text to a hover tooltip on the checkbox (native `title` attribute is sufficient — no new component needed).
- The checkbox must be wired to the same state value it currently uses; this is a UI relocation, not a behavior change.

## Files Touched (final list)

1. `docs/site/astro.config.mjs` — sidebar reorder (A1)
2. `docs/site/src/content/docs/playground.mdx` — frontmatter `tableOfContents: false` (A2)
3. `docs/site/src/components/playground.css` — contrast tokens + fixes (A3)
4. `docs/site/src/components/Playground.tsx` and/or `ui/Presets.tsx` — Randomize CTA + keyboard shortcut (A4)
5. `docs/site/src/components/ui/StyleControls.tsx` (path to confirm) — auto-fit inline (A5)

Implementation must verify the exact paths for items 4 and 5 before editing — the inventory shows multiple candidate components.

## Testing Approach

- **Visual regression:** re-run Chrome DevTools contrast scan against `https://og-engine.com/playground/` (or local dev server) after the CSS pass; every element listed in A3 must clear 4.5:1.
- **Functional smoke test:**
  - Confirm `R` keypress triggers Randomize while focus is on the page body.
  - Confirm `R` keypress does **not** randomize when focus is in the Title/Description/Author/Tag input.
  - Confirm Auto-fit checkbox still toggles the same state (use React DevTools or a small console log during dev).
  - Confirm sidebar order matches the spec at desktop and mobile breakpoints.
- **No new automated tests** — this PR is CSS + reorganization with no business logic changes.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Starlight CSS specificity may require `!important` on label colors | If encountered, use the existing `playground.css` cascade rather than `!important`; only escalate if scoped selectors fail |
| `R` keyboard shortcut conflicts with browser refresh modifiers | Listener checks `event.key === 'r'` AND no `metaKey/ctrlKey/altKey/shiftKey` |
| Moving Auto-fit checkbox could break a wired-up event handler | Reuse the existing state binding; do not introduce a new prop or hook |
| `Compare` group dissolution may leave dangling links elsewhere in docs | grep for `/compare/puppeteer/` references; the page itself stays at the same URL, so no redirects needed |
| Badge `variant: 'success'` may not exist on the installed Starlight version | Fall back to `variant: 'tip'` or no variant if Starlight rejects the prop |

## Acceptance Criteria

- [ ] Sidebar matches the new order on desktop and mobile.
- [ ] `/playground/` page no longer renders a right-hand TOC column.
- [ ] All contrast failures listed in A3 clear WCAG AA (4.5:1) when measured against the live background.
- [ ] Randomize CTA is full-width, above preset cards, with `R` keyboard shortcut working.
- [ ] Auto-fit checkbox sits next to the Title size slider; the original Fine-tuning entry is removed.
- [ ] No console errors introduced.
- [ ] Existing playground functionality (rendering, downloading, code copy) unchanged.

## Out of Scope (explicit reminders)

- Canvas/preview sizing → Spec B
- Two-column app shell / custom Astro layout → Spec B
- Font picker / Google Fonts → Spec C
- URL state, side-by-side previews, fork-as-React → not planned
