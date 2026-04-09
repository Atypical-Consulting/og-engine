# Spec B — Playground App Shell

**Date:** 2026-04-09
**Status:** Approved (pending user review of written spec)
**Author:** brainstorming session
**Part of:** 3-spec sequence (A → B → C) for playground improvements
**Builds on:** Spec A (playground polish), already shipped

## Context

After Spec A polished the existing playground in-place (sidebar reorder, hidden TOC, contrast fixes, Surprise me CTA, inline Auto-fit toggle), the playground still lives inside Starlight's standard documentation layout. That layout was designed for prose, not for a configurable application: the global docs sidebar eats ~280px on the left, the right TOC was previously eating another column (Spec A killed it), and the centered content max-width caps the preview at ~370px wide on a 1400px viewport.

The product *is* the visual output. Anything that compresses the preview compresses the value. Spec B replaces the document-style layout with a real two-column app shell on `/playground/` only, large enough that the preview becomes the visual center of gravity, and reorganizes the supporting UI around it.

## Goals

1. Give the preview the dominant share of the viewport on desktop.
2. Make the playground feel like an application, not a doc page, while preserving the global Starlight header (brand consistency, search, theme toggle, GitHub link).
3. Hide the code output behind a deliberate user action so the preview never has to compete with it.
4. Hoist the format pills and the render-time HUD into a toolbar above the preview so they stop biting into the canvas.
5. Keep the playground usable on mobile by stacking preview-on-top, controls-below.

## Non-goals

- Font picker / Google Fonts catalog — handled in Spec C.
- Zoom toggle (`Fit / 50% / 100% / Actual`) — YAGNI; the existing FullscreenPreview already covers actual-pixel inspection.
- URL state synchronization, side-by-side format previews, "Fork as React component" export — not planned.
- Authentication-aware UI in a custom header — Spec B keeps the global Starlight header, which already handles whatever auth state exists.
- Functional changes to rendering, the API client, font loading, or any non-layout behavior.

## Architecture

### Layout shell

A new Astro layout file dedicated to `/playground/`. It composes Starlight's global header with a custom body that gives the controls and preview their own columns and bypasses the standard `<TwoColumnContent>` wrapper that documentation pages use.

```
┌────────────────────────────────────────────────────────┐
│ Starlight global header (logo · search · GH · theme)  │
├────────────────┬───────────────────────────────────────┤
│                │ ┌─ toolbar ──────────────────────┐   │
│  Controls      │ │ format pills    HUD chips       │   │
│  column        │ ├─────────────────────────────────┤   │
│  (380px        │ │                                 │   │
│   fixed,       │ │     Preview canvas              │   │
│   scrollable)  │ │     (fluid, centered,           │   │
│                │ │      aspect-ratio per format)   │   │
│  ▸ Surprise    │ │                                 │   │
│    me (sticky) │ │                                 │   │
│  ▸ Format-     │ │                                 │   │
│    less form   │ │                  [View code ↑]  │   │
│    sections    │ └─────────────────────────────────┘   │
└────────────────┴───────────────────────────────────────┘
```

When the user clicks "View code ↑", a drawer slides up from the bottom of the preview column containing the existing CodeOutput component:

```
┌────────────────┬───────────────────────────────────────┐
│                │ ┌─ toolbar ──────────────────────┐   │
│  Controls      │ │ format pills    HUD chips       │   │
│                │ ├─────────────────────────────────┤   │
│                │ │     Preview canvas (compressed) │   │
│                │ ├─ View code ↓ ───────────────────┤   │
│                │ │ curl │ sdk │ json      [copy]   │   │
│                │ │ ─────────────────────────────── │   │
│                │ │ curl -X POST ...                │   │
│                │ │ ...                             │   │
└────────────────┴─└─────────────────────────────────┘───┘
```

### Breakpoints

- **Desktop ≥1024px:** controls fixed 380px, preview fills the remainder. Preview column does not scroll; controls column scrolls independently.
- **Tablet 768–1023px:** controls fixed 340px, preview fills the remainder. Same scroll model.
- **Mobile <768px:** stack vertically. Preview on top (full width, capped at `aspect-ratio: 1200/630; max-height: 50vh`), controls below in a single scrollable column. The "View code" drawer still works, sliding up from the bottom of the viewport.

### Header reuse, not rewrite

The custom layout MUST reuse Starlight's existing global header rather than re-implementing one. This preserves:
- Brand consistency (logo, fonts)
- The search modal (Pagefind)
- The theme toggle
- The GitHub link
- Any nav links Starlight injects

The implementation may reuse Starlight's `<PageFrame>` / `<Header>` components, or render the layout as a Starlight `splash` template that suppresses the standard content shell while keeping the header. Implementation must verify the cleanest option during planning.

### Preview toolbar

A new ~44px toolbar component sits directly above the preview canvas, replacing two pieces of currently-overlaid or in-form UI:

1. **Format pills** (`OG 1200x630`, `Twitter 1200x675`, `Square 1080x1080`, `LinkedIn 1200x627`, `Story 1080x1920`) — moved out of the controls column.
2. **Render HUD chips** (`2.9ms`, `1L title`, `293x` etc.) — moved out of the bottom-overlay-on-canvas position.

The existing `RenderHUD` and `FormatSelector` components are reused; only their parent container changes.

### Code drawer

The existing `CodeOutput` component (curl/SDK/JSON tabs + copy button) is moved out of the controls/preview tree and into a new drawer container that:

- Is **collapsed by default** on first visit
- Has a small "View code ↑" pill button anchored to the bottom-center of the preview column (or fixed to the bottom of the viewport on mobile)
- When expanded, slides up from the bottom of the preview column, taking ~60% of its vertical space
- Closes via a "Hide code ↓" button on the drawer header, OR by pressing `Escape`
- Persists open/closed state in `localStorage` under key `pg-code-drawer-open`
- Animates open/close with a CSS transition (no animation library)

The drawer's z-index is ordered so that `FullscreenPreview` (already in the codebase) renders above it.

### Sticky CTA

The `Surprise me` CTA from Spec A is currently the first item in the controls column. In Spec B's app shell, it becomes `position: sticky; top: 0` inside the controls column so it remains accessible even after the user scrolls deep into the form.

## Files Touched (provisional)

The implementation plan will verify exact paths and may add or remove files based on what Starlight allows.

1. `docs/site/src/layouts/PlaygroundLayout.astro` — NEW custom layout
2. `docs/site/src/content/docs/playground.mdx` — switch to the new layout (via Starlight `template: splash` frontmatter, or by moving content to `src/pages/playground.astro` if cleaner)
3. `docs/site/src/components/Playground.tsx` — restructure JSX into the two-column shell, host the new drawer state, integrate the new toolbar
4. `docs/site/src/components/ui/PreviewToolbar.tsx` — NEW component composing FormatSelector + RenderHUD
5. `docs/site/src/components/ui/CodeDrawer.tsx` — NEW wrapper around CodeOutput with open/closed state, animation, Escape handler, localStorage persistence
6. `docs/site/src/components/playground.css` — new layout styles, drawer animation, breakpoint rules
7. `docs/site/src/components/ui/RenderHUD.tsx` — minor: support a "toolbar" rendering mode (no absolute positioning) in addition to its current overlay mode, OR be replaced by a new presentation in the toolbar
8. `docs/site/src/components/ui/CodeOutput.tsx` — minor: ensure scroll behavior works inside a fixed-height drawer container

## Testing Approach

- **Visual regression (manual):** screenshot-compare the playground at three viewport sizes (1440, 900, 375) before and after Spec B. The "after" should show: no left docs sidebar, dominant preview, sticky Surprise me, code drawer collapsed.
- **Functional smoke test:**
  - Format pills in the toolbar still switch the preview format
  - Render HUD chips update on every render
  - "View code ↑" expands the drawer; clicking "Hide code" or pressing Escape collapses it
  - Drawer state survives a page reload
  - Surprise me sticky behavior: scroll deep into the form on desktop, button stays visible
  - Mobile (375px): preview is on top and visible; scrolling shows controls below
  - All Spec A behaviors still work: sidebar badge, contrast, R keyboard shortcut, Auto-fit inline toggle, Randomize
- **No new automated tests** — this is layout work without business logic changes. Existing rendering pipelines (tested elsewhere) are untouched.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Bypassing Starlight's content layout breaks the search modal, theme toggle, or GitHub link | Reuse Starlight's `<PageFrame>` / header components directly rather than re-implementing them. Verify with manual smoke test before committing. |
| Drawer animation conflicts with the existing FullscreenPreview overlay | Explicit z-index ordering: `FullscreenPreview > Drawer > Toolbar > Preview canvas`. Test by opening fullscreen while the drawer is open. |
| Mobile preview-on-top is too tall and pushes controls below the fold on small phones | Cap mobile preview height at `min(aspect-ratio-natural, 50vh)`. Verify on a 375×667 viewport (iPhone SE). |
| `100vh` is broken on iOS Safari (the address bar makes it inaccurate) | Use `100dvh` (dynamic viewport height) for the layout shell height. Fall back to `100vh` for older browsers via `@supports`. |
| The new layout file gets served at `/playground/` and accidentally breaks the existing URL or sitemap | Verify the same URL still resolves, both during dev and after a production build. |
| Starlight version may not expose `<PageFrame>` for reuse | Fall back to wrapping content with a minimal custom shell that imports Starlight's `<Header>` component directly. Worst case: re-implement a thin header that matches Starlight's visual style. |
| Drawer + sticky Surprise me may have z-index collisions on mobile | Use a single z-index scale defined as CSS custom properties at the top of `playground.css`. |

## Acceptance Criteria

- [ ] `/playground/` renders without the docs sidebar on the left
- [ ] Starlight global header still renders at top with working search, theme toggle, GitHub link
- [ ] At desktop ≥1024px, controls column is exactly 380px wide and the preview column fills the rest
- [ ] At tablet 768–1023px, controls column is 340px wide
- [ ] At mobile <768px, preview stacks above controls and is the first thing visible
- [ ] Preview column does not scroll on desktop/tablet; controls column scrolls independently
- [ ] Format pills live in a toolbar above the preview, not in the controls column
- [ ] Render HUD chips render in the toolbar (not overlaying the canvas)
- [ ] Code drawer is collapsed by default
- [ ] "View code ↑" button toggles the drawer
- [ ] Pressing Escape closes the drawer
- [ ] Drawer open/closed state survives a page reload (`localStorage`)
- [ ] Surprise me CTA is `position: sticky` in the controls column
- [ ] All Spec A behaviors still work: contrast, R keyboard shortcut, Auto-fit inline toggle, sidebar Try it badge
- [ ] No console errors introduced
- [ ] Existing functionality intact: download PNG, fullscreen preview, drag-drop background images, accent picker, gradient picker, font picker, slider controls, all preset cards, API mode toggle (if visible)

## Out of Scope (explicit reminders)

- Font picker / Google Fonts → Spec C
- URL state, side-by-side previews, fork-as-React export → not planned
- Auth-aware nav, custom header rewrite → not needed
- Zoom toggle on the preview → YAGNI (FullscreenPreview already handles inspection)
