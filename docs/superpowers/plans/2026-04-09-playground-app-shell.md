# Playground App Shell (Spec B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the playground's docs-style layout with a dedicated two-column app shell that gives the preview the dominant share of the viewport, hides the code output behind a collapsible bottom drawer, and hoists format pills and the render HUD into a toolbar above the preview.

**Architecture:** Switch `/playground/` to Starlight's existing `template: splash` (removes sidebar + TOC, keeps global header — already used by the home page). Restructure `Playground.tsx` into a fixed-left + fluid-right two-column shell constrained to the viewport height. Extract a `PreviewToolbar` component that composes the existing `FormatSelector` and `RenderHUD` in non-overlay mode, and a `CodeDrawer` component that wraps the existing `CodeOutput` with open/closed state persisted in localStorage and an Escape key handler that yields to any open `FullscreenPreview`.

**Tech Stack:** Astro 5, Starlight (splash template), React 19, Bun, Biome (lint), tsc (typecheck), lefthook pre-commit (runs biome + tsc automatically — do not bypass).

**Spec:** `docs/superpowers/specs/2026-04-09-playground-app-shell-design.md`

**Builds on:** Spec A (`docs/superpowers/specs/2026-04-09-playground-polish-design.md`) — already shipped.

**Working directory:** `docs/site` for all `bun` commands. Repo root for `git`.

---

## Conventions for every task

- All commits go on `dev` (the repo's main branch). No branching needed for Spec B.
- Pre-commit hook auto-runs `biome check src/ tests/` and `tsc --noEmit`. Never bypass with `--no-verify`. If hooks fail, fix the underlying issue and re-stage.
- After every code change, run `cd docs/site && bun run build` to catch issues early.
- For visual verification run `cd docs/site && bun run dev` and open `http://localhost:4321/playground/`.

---

## File Structure (locked in)

**New files:**
- `docs/site/src/components/ui/PreviewToolbar.tsx` — composes format pills and the render HUD
- `docs/site/src/components/ui/CodeDrawer.tsx` — collapsible bottom drawer wrapping `CodeOutput`

**Modified files:**
- `docs/site/src/content/docs/playground.mdx` — frontmatter: add `template: splash`; keep `tableOfContents: false` from Spec A
- `docs/site/src/components/Playground.tsx` — restructure into two-column app shell; hoist format pills into toolbar; move CodeOutput into drawer; delete the inline "response headers" block that currently duplicates HUD info
- `docs/site/src/components/ui/RenderHUD.tsx` — remove self-positioning; add a `variant?: 'overlay' | 'toolbar'` prop so existing overlay behavior is preserved as an option, and toolbar mode is the new default for Spec B
- `docs/site/src/components/playground.css` — replace the Spec A responsive rules with new app-shell styles, drawer animation, mobile stack rules

**Unchanged but important:**
- `docs/site/src/components/ui/FormatSelector.tsx` — reused as-is inside PreviewToolbar
- `docs/site/src/components/ui/CodeOutput.tsx` — reused as-is inside CodeDrawer
- `docs/site/src/components/ui/FullscreenPreview.tsx` — untouched; CodeDrawer coordinates with it via DOM presence check
- All other playground component files — untouched

---

## Task 1: Switch `/playground/` to splash template

**Files:**
- Modify: `docs/site/src/content/docs/playground.mdx` (frontmatter only)

This task gets the sidebar out of the way so every subsequent visual change actually has room to show. Starlight's splash template is already proven in the codebase — the home page (`src/content/docs/index.mdx`) and `checkout-success.mdx` both use it.

- [ ] **Step 1: Add `template: splash` to the frontmatter**

Replace the existing frontmatter:

```yaml
---
title: OG Image Playground
description: Build and preview OG images in real-time with the interactive playground. Edit title, description, styles, and formats — no API key or signup required.
tableOfContents: false
---
```

with:

```yaml
---
title: OG Image Playground
description: Build and preview OG images in real-time with the interactive playground. Edit title, description, styles, and formats — no API key or signup required.
template: splash
tableOfContents: false
---
```

- [ ] **Step 2: Build**

Run: `cd docs/site && bun run build`
Expected: build succeeds. If Starlight complains about `tableOfContents: false` being redundant with `template: splash`, remove the `tableOfContents` line (splash already suppresses the TOC).

- [ ] **Step 3: Visual smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.
Expected: the global Starlight header is still at the top (logo, search, GitHub, theme toggle). The left docs sidebar is **gone**. The playground content is now centered but still constrained by splash's content width. It looks wider than before but not full-bleed yet — that's Task 2's job.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/playground.mdx
git commit -m "feat(playground): switch to splash template

Drops the docs sidebar on /playground/ to free the horizontal
space the two-column app shell needs. Keeps the Starlight
global header (brand, search, theme, GitHub).

Refs spec B (shell)."
```

---

## Task 2: Refactor Playground.tsx root into two-column app shell

**Files:**
- Modify: `docs/site/src/components/Playground.tsx` (root return JSX)
- Modify: `docs/site/src/components/playground.css` (new app shell rules; delete old responsive rules)

In this task we change the layout container from the current 50/50 grid to a fixed-left (380px) + fluid-right split that consumes the full available width below the Starlight header. The existing form sections stay in the left column; the existing preview setup (canvas + upgrade pill + download button + code output) all stays in the right column for now — later tasks will hoist format pills to a toolbar and move CodeOutput into a drawer.

This task is the biggest in the plan. Do it carefully and commit once it builds and renders correctly.

- [ ] **Step 1: Replace the responsive block in `playground.css`**

Open `docs/site/src/components/playground.css`. Find the current responsive blocks (the `@media (max-width: 768px)` block around lines 159-169 and the `@media (min-width: 769px)` block around lines 171-178). Replace BOTH blocks with:

```css
/* ── App shell layout ── */
.pg-app-shell {
  /* Full-bleed escape from Starlight splash content container */
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  /* Fill the viewport below the Starlight header */
  min-height: calc(100dvh - var(--sl-nav-height, 60px));
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 0;
  background: #050810;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

@media (max-width: 1023px) and (min-width: 768px) {
  .pg-app-shell {
    grid-template-columns: 340px 1fr;
  }
}

@media (max-width: 767px) {
  .pg-app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    min-height: auto;
  }
}

.pg-controls-col {
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(100dvh - var(--sl-nav-height, 60px));
  padding: 16px;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pg-preview-col {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
  max-height: calc(100dvh - var(--sl-nav-height, 60px));
}

@media (max-width: 767px) {
  .pg-controls-col {
    max-height: none;
    border-right: none;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    order: 2;
  }
  .pg-preview-col {
    max-height: none;
    order: 1;
  }
  .pg-preview-col .pg-canvas-wrapper {
    max-height: 50vh;
  }
}
```

Note: we are deleting the old Spec A `pg-preview-col` sticky rules (they were designed for the old 50/50 grid) and replacing them with app-shell rules. The `.pg-layout` custom-property block near the top of the file stays.

- [ ] **Step 2: Update the Playground.tsx root container**

Open `docs/site/src/components/Playground.tsx`. Find the root `<div>` that currently starts with `<div className="pg-layout not-content" ...>` (around line 169).

Replace the opening root div and its `style` prop from:

```tsx
    <div
      className="pg-layout not-content"
      style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 600,
        ['--pg-accent-alpha' as string]: accentAlpha,
        ['--pg-accent-border' as string]: accentBorder,
      }}
    >
```

to:

```tsx
    <div
      className="pg-layout pg-app-shell not-content"
      style={{
        ['--pg-accent-alpha' as string]: accentAlpha,
        ['--pg-accent-border' as string]: accentBorder,
      }}
    >
```

Keep `pg-layout` on the element so the `--pg-text-secondary` / `--pg-text-tertiary` tokens from Spec A still cascade to everything inside.

- [ ] **Step 3: Wrap the controls column**

Still in Playground.tsx, find the existing controls column (the div that contains `<Presets onSelect={applyPreset} .../>` through `<Section title="Fine-tuning">`). It currently starts with:

```tsx
      {/* Controls column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
```

Replace that opening div with:

```tsx
      {/* Controls column */}
      <div className="pg-controls-col">
```

Remove the inline `style={{ display: 'flex', flexDirection: 'column', gap: 4 }}` because those styles now live in `.pg-controls-col` in the CSS file.

- [ ] **Step 4: Wrap the preview column**

Still in Playground.tsx, find the existing preview column opening div (currently around line 294):

```tsx
      {/* Preview column */}
      <div className="pg-preview-col" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
```

Replace with:

```tsx
      {/* Preview column */}
      <div className="pg-preview-col" style={{ gap: 12 }}>
```

(Keep the `gap: 12` as an inline style for now — moving it to CSS is not worth the churn.)

- [ ] **Step 5: Build**

Run: `cd docs/site && bun run build`
Expected: build succeeds.

- [ ] **Step 6: Visual smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Verify:
- The layout is full viewport width (no Starlight content max-width constraint)
- Controls column on the left is exactly 380px wide
- Preview column fills the rest
- The preview canvas is visibly larger than before
- The form in the controls column scrolls independently of the preview — scroll wheel inside the controls scrolls them, scroll wheel over the preview does nothing (because preview column has `overflow: hidden` and nothing to scroll)
- Resize the window narrower than 1024px → controls shrink to 340px
- Resize narrower than 768px → columns stack with preview on top, controls below
- All existing functionality still works: preview renders, HUD chips still overlay the canvas (for now), preset cards work, form controls update the preview, download button works

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add docs/site/src/components/Playground.tsx \
        docs/site/src/components/playground.css
git commit -m "feat(playground): two-column app shell layout

Replaces the 50/50 docs-style grid with a fixed-left (380px)
controls column and a fluid preview column that together fill
the viewport below the Starlight header. Controls scroll
independently; preview column is non-scrolling. Mobile stacks
preview-on-top, controls-below.

Refs spec B (shell)."
```

---

## Task 3: Add a toolbar variant to RenderHUD

**Files:**
- Modify: `docs/site/src/components/ui/RenderHUD.tsx`

RenderHUD currently positions itself with `position: absolute; bottom: 10; right: 10` inside its parent. For Spec B we need it to render inline inside the PreviewToolbar (Task 4) instead. We add a `variant` prop with default `'toolbar'` (the new Spec B mode) and optional `'overlay'` (the old behavior kept for completeness in case anyone needs it later).

- [ ] **Step 1: Replace the RenderHUD component**

Open `docs/site/src/components/ui/RenderHUD.tsx`. Replace the entire file contents with:

```tsx
import { useState, useEffect } from 'react';
import type { RenderResult } from '../engine/canvas-renderer';

interface Props {
  renderTime: number;
  info: RenderResult | null;
  accent: string;
  /** 'toolbar' renders inline (no self-positioning). 'overlay' keeps the
   *  legacy absolute positioning used when the HUD sits on top of a canvas. */
  variant?: 'toolbar' | 'overlay';
}

export function RenderHUD({ renderTime, info, accent, variant = 'toolbar' }: Props) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const id = setTimeout(() => setPulse(false), 300);
    return () => clearTimeout(id);
  }, [renderTime]);

  const baseStyle: React.CSSProperties = {
    display: 'flex', gap: 8, alignItems: 'center',
    padding: '6px 12px', borderRadius: 8,
    background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: 10, fontFamily: 'var(--sl-font-mono, monospace)',
    color: '#94a3b8', pointerEvents: 'none',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute', bottom: 10, right: 10, zIndex: 5,
    ...baseStyle,
  };

  return (
    <div style={variant === 'overlay' ? overlayStyle : baseStyle}>
      <span className={pulse ? 'pg-render-pulse' : ''} style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {renderTime.toFixed(1)}ms
      </span>
      {info && (
        <>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span>{info.titleVisibleLines}L title</span>
          {info.overflow && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
              <span style={{ color: '#fb7185' }}>overflow</span>
            </>
          )}
        </>
      )}
      <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
      <span style={{ color: '#fbbf24' }}>{Math.round(850 / Math.max(0.1, renderTime))}x</span>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd docs/site && bun run build`
Expected: build succeeds. No existing usage of `<RenderHUD>` passes a `variant` prop, so they all default to `'toolbar'` — the visual overlay will temporarily disappear from the canvas until Task 4 puts it in the toolbar. That's expected.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/components/ui/RenderHUD.tsx
git commit -m "refactor(playground): add toolbar variant to RenderHUD

Adds a variant prop so RenderHUD can render inline inside the
new PreviewToolbar instead of self-positioning as an overlay.
The overlay mode is preserved via variant='overlay'. Default
is 'toolbar' since the HUD's primary home in Spec B is the
toolbar above the preview.

Refs spec B (toolbar)."
```

---

## Task 4: Create PreviewToolbar component

**Files:**
- Create: `docs/site/src/components/ui/PreviewToolbar.tsx`

This component composes the existing `FormatSelector` and `RenderHUD` into a horizontal toolbar that sits above the preview canvas. Format pills on the left, render HUD chips on the right, with the toolbar itself occupying a fixed-height row.

- [ ] **Step 1: Create the component file**

Create `docs/site/src/components/ui/PreviewToolbar.tsx` with this content:

```tsx
import type { RenderResult } from '../engine/canvas-renderer';
import type { FormatKey } from '../engine/formats';
import { FormatSelector } from './FormatSelector';
import { RenderHUD } from './RenderHUD';

interface Props {
  format: FormatKey;
  onFormatChange: (value: FormatKey) => void;
  renderTime: number;
  info: RenderResult | null;
  accent: string;
}

export function PreviewToolbar({ format, onFormatChange, renderTime, info, accent }: Props) {
  return (
    <div
      className="pg-preview-toolbar"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '8px 4px', marginBottom: 12,
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
        <FormatSelector value={format} onChange={onFormatChange} accent={accent} />
      </div>
      <div style={{ flex: '0 0 auto' }}>
        <RenderHUD renderTime={renderTime} info={info} accent={accent} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd docs/site && bun run build`
Expected: build succeeds. The component is not yet used anywhere — that comes in Task 5.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/components/ui/PreviewToolbar.tsx
git commit -m "feat(playground): add PreviewToolbar component

Composes FormatSelector and RenderHUD into a horizontal row
designed to sit above the preview canvas. Not yet wired in —
Task 5 hoists the existing usages into this toolbar.

Refs spec B (toolbar)."
```

---

## Task 5: Hoist format pills and HUD into the preview toolbar

**Files:**
- Modify: `docs/site/src/components/Playground.tsx` (remove Format section from controls, remove HUD overlay, add PreviewToolbar at top of preview column)

- [ ] **Step 1: Add the PreviewToolbar import**

At the top of `docs/site/src/components/Playground.tsx`, find the existing imports from `./ui/...`. Add a new import line:

```tsx
import { PreviewToolbar } from './ui/PreviewToolbar';
```

(Place it near the other `./ui/` imports for clarity.)

- [ ] **Step 2: Delete the Format section from the controls column**

Find the Format section in the controls column (around line 181):

```tsx
        <Section title="Format">
          <FormatSelector value={format} onChange={setFormat} accent={accent} />
        </Section>
```

Delete those three lines entirely. Format switching now lives in the toolbar.

- [ ] **Step 3: Remove the old `FormatSelector` import if unused**

Check the imports at the top of Playground.tsx. If `FormatSelector` is no longer used directly (it's still imported inside PreviewToolbar, but not in Playground.tsx itself), remove it from Playground.tsx's import list. The line currently reads:

```tsx
import { FormatSelector } from './ui/FormatSelector';
```

Remove that line.

- [ ] **Step 4: Remove the overlay HUD from the canvas wrapper**

Find the `pg-canvas-wrapper` JSX (around line 318). It currently contains:

```tsx
          <RenderHUD renderTime={renderTime} info={info} accent={accent} />
          <DropZone visible={dragging} accent={accent} />
```

Remove the `<RenderHUD .../>` line entirely. Keep the `<DropZone />` line.

- [ ] **Step 5: Remove the RenderHUD import from Playground.tsx**

Scroll up to the imports. Delete the line:

```tsx
import { RenderHUD } from './ui/RenderHUD';
```

(RenderHUD is now only referenced inside PreviewToolbar.)

- [ ] **Step 6: Insert the PreviewToolbar at the top of the preview column**

Still in Playground.tsx, find the opening of the preview column content. It currently starts with an `<a ...>` upgrade pill (around line 296):

```tsx
      {/* Preview column */}
      <div className="pg-preview-col" style={{ gap: 12 }}>
        {/* Upgrade / Signup CTA — persistent path from playground into the funnel */}
        <a
          href={useApi ? '/pricing/' : '/quick-start/'}
          ...
        >
          ...
        </a>
```

Insert the PreviewToolbar BEFORE the upgrade pill's `<a>`, so it becomes the first child of the preview column:

```tsx
      {/* Preview column */}
      <div className="pg-preview-col" style={{ gap: 12 }}>
        <PreviewToolbar
          format={format}
          onFormatChange={setFormat}
          renderTime={renderTime}
          info={info}
          accent={accent}
        />
        {/* Upgrade / Signup CTA — persistent path from playground into the funnel */}
        <a
          href={useApi ? '/pricing/' : '/quick-start/'}
          ...
        >
          ...
        </a>
```

- [ ] **Step 7: Delete the duplicate "RESPONSE HEADERS" block**

The preview column contains an inline block (starting around line 356) that duplicates the HUD information as a "RESPONSE HEADERS" table. With the HUD now always visible in the toolbar, this block is redundant AND visually heavy. Delete it entirely.

Find and delete:

```tsx
        {/* Response headers */}
        {info && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, marginBottom: 8 }}>RESPONSE HEADERS</div>
            {[
              ['X-Render-Time-Ms', renderTime.toFixed(2)],
              ['X-Title-Lines', String(info.titleVisibleLines)],
              ['X-Desc-Lines', String(info.descVisibleLines)],
              ['X-Layout-Overflow', String(info.overflow)],
              ['Content-Type', 'image/png'],
            ].map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <span style={{ color: 'var(--pg-text-secondary)' }}>{k}</span>
                <span style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--sl-font-mono)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
```

Delete that entire block.

- [ ] **Step 8: Build**

Run: `cd docs/site && bun run build`
Expected: build succeeds with no unused-import warnings from biome.

- [ ] **Step 9: Visual smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Verify:
- The Format section is gone from the controls column
- A row of format pills (OG, Twitter, Square, LinkedIn, Story) appears at the top of the preview column
- The render HUD chips (X.Xms, 1L title, Nx) appear in the same row on the right
- Clicking a format pill still changes the preview aspect ratio
- The canvas no longer has a HUD overlay in its bottom-right corner
- The duplicated "RESPONSE HEADERS" card below the preview is gone
- No console errors

Stop the dev server.

- [ ] **Step 10: Commit**

```bash
git add docs/site/src/components/Playground.tsx
git commit -m "feat(playground): hoist format pills and HUD into toolbar

Moves FormatSelector out of the controls column and RenderHUD
out of its canvas overlay position. Both now live in the new
PreviewToolbar above the preview. Removes the now-redundant
inline 'RESPONSE HEADERS' block that duplicated HUD info.

Refs spec B (toolbar)."
```

---

## Task 6: Make Surprise me sticky in the controls column

**Files:**
- Modify: `docs/site/src/components/ui/Presets.tsx` (wrap the Quick Start label + Surprise me button in a sticky container)
- Modify: `docs/site/src/components/playground.css` (sticky rule)

The Surprise me CTA should remain visible even after the user scrolls deep into the form. Because the controls column now scrolls independently (Task 2), we can use `position: sticky` on the Surprise me button's wrapper.

- [ ] **Step 1: Add the sticky wrapper class rule to `playground.css`**

In `docs/site/src/components/playground.css`, add at the bottom of the file:

```css
.pg-surprise-sticky {
  position: sticky;
  top: 0;
  z-index: 4;
  padding: 8px 0;
  background: #050810;
  margin: -16px -16px 0;
  padding-left: 16px;
  padding-right: 16px;
}
```

The negative margins bleed the sticky bar edge-to-edge across the controls column's 16px padding, so the background reliably covers content scrolling underneath.

- [ ] **Step 2: Apply the sticky wrapper in `Presets.tsx`**

Open `docs/site/src/components/ui/Presets.tsx`. Find the current top-level return:

```tsx
export function Presets({ onSelect, accent }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase' }}>
        Quick Start
      </span>

      <button
        onClick={() => onSelect(randomPreset())}
        className="pg-surprise-btn"
        ...
      >
        ...
      </button>

      <div style={{ display: 'grid', ...}}>
        {PRESETS.map(...)}
      </div>
    </div>
  );
}
```

Replace with:

```tsx
export function Presets({ onSelect, accent }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="pg-surprise-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase' }}>
          Quick Start
        </span>

        <button
          onClick={() => onSelect(randomPreset())}
          className="pg-surprise-btn"
          aria-label="Randomize all settings"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: `1px solid ${accent}55`,
            background: `linear-gradient(135deg, ${accent}1a, ${accent}08)`,
            color: '#e2e8f0', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', letterSpacing: 0.3,
            transition: 'transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease',
          }}
        >
          <span>
            <span style={{ marginRight: 8 }}>🎲</span>
            Surprise me
          </span>
          <kbd
            style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              border: `1px solid ${accent}66`, background: `${accent}14`,
              color: accent, fontFamily: 'var(--sl-font-mono)', letterSpacing: 0,
            }}
          >
            R
          </kbd>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            className="pg-preset-card"
            onClick={() => onSelect(p.data)}
            style={{
              padding: '10px 12px', borderRadius: 8, textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 4 }}>{p.emoji}</div>
            <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
            <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', lineHeight: 1.3 }}>{p.data.tag}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

Only the `<div className="pg-surprise-sticky">` wrapper is new; the label and button markup are identical to their Spec A state.

- [ ] **Step 3: Build**

Run: `cd docs/site && bun run build`
Expected: build succeeds.

- [ ] **Step 4: Visual smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Verify:
- Scroll deep into the controls column (e.g., to the Fine-tuning section). The `Surprise me` button stays pinned at the top of the visible controls area.
- Content scrolling underneath is fully covered by the sticky bar's background (not bleeding through).
- Clicking Surprise me still randomizes.
- `R` keyboard shortcut still works.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/components/ui/Presets.tsx \
        docs/site/src/components/playground.css
git commit -m "feat(playground): sticky Surprise me CTA in controls column

Wraps the Quick Start label and Surprise me button in a sticky
container so the CTA stays visible regardless of how deep the
user scrolls into the form.

Refs spec B (shell)."
```

---

## Task 7: Create CodeDrawer component

**Files:**
- Create: `docs/site/src/components/ui/CodeDrawer.tsx`
- Modify: `docs/site/src/components/playground.css` (drawer animation)

This component wraps the existing `CodeOutput` in a collapsible bottom drawer with:
- Open/closed state controlled by a "View code ↑" / "Hide code ↓" button
- `localStorage` persistence under key `pg-code-drawer-open`
- Global Escape key handler that closes the drawer, but yields to FullscreenPreview if it's open (detected by presence of `.pg-modal-backdrop`)
- A CSS transition for the slide-up animation

- [ ] **Step 1: Add the drawer animation rules to `playground.css`**

In `docs/site/src/components/playground.css`, add at the bottom:

```css
/* ── Code drawer ── */
.pg-code-drawer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 60%;
  display: flex;
  flex-direction: column;
  background: #0a0d16;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  transform: translateY(calc(100% - 40px));
  transition: transform 0.25s ease;
  z-index: 20;
}

.pg-code-drawer.open {
  transform: translateY(0);
}

.pg-code-drawer-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 40px;
  padding: 0 16px;
  background: transparent;
  border: none;
  color: var(--pg-text-secondary);
  font-size: 11px;
  font-family: inherit;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  flex: 0 0 40px;
}

.pg-code-drawer-handle:hover {
  color: #e2e8f0;
}

.pg-code-drawer-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 0 16px 16px;
}

@media (max-width: 767px) {
  .pg-code-drawer {
    position: fixed;
    max-height: 70vh;
  }
}
```

- [ ] **Step 2: Create the component file**

Create `docs/site/src/components/ui/CodeDrawer.tsx` with:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { CodeOutput } from './CodeOutput';

const STORAGE_KEY = 'pg-code-drawer-open';

interface Props {
  // biome-ignore lint/suspicious/noExplicitAny: config shape is dynamic
  config: any;
  accent: string;
}

export function CodeDrawer({ config, accent }: Props) {
  const [open, setOpen] = useState(false);

  // Load persisted state on mount (client-only)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setOpen(true);
    } catch {
      // localStorage unavailable — ignore
    }
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // ignore
    }
  }, [open]);

  // Escape closes — but yields to FullscreenPreview if it's open
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (!open) return;
    // If FullscreenPreview modal is open, let it handle Escape instead
    if (document.querySelector('.pg-modal-backdrop')) return;
    e.preventDefault();
    setOpen(false);
  }, [open]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <div className={`pg-code-drawer${open ? ' open' : ''}`} aria-label="Code output">
      <button
        type="button"
        className="pg-code-drawer-handle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="pg-code-drawer-body"
      >
        <span>{open ? 'Hide code ↓' : 'View code ↑'}</span>
      </button>
      <div id="pg-code-drawer-body" className="pg-code-drawer-body">
        <CodeOutput config={config} accent={accent} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `cd docs/site && bun run build`
Expected: build succeeds. Biome may warn about `any` — the inline `biome-ignore` comment handles it. If biome errors instead of warns, check that the `biome-ignore` comment syntax matches the project's biome config.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/ui/CodeDrawer.tsx \
        docs/site/src/components/playground.css
git commit -m "feat(playground): add CodeDrawer component

Collapsible bottom drawer wrapping CodeOutput with localStorage
persistence and Escape-to-close that yields to FullscreenPreview
via DOM presence check. Not yet wired in — Task 8 replaces the
inline CodeOutput with this drawer.

Refs spec B (drawer)."
```

---

## Task 8: Replace inline CodeOutput with CodeDrawer in Playground.tsx

**Files:**
- Modify: `docs/site/src/components/Playground.tsx`

- [ ] **Step 1: Add the import**

At the top of `docs/site/src/components/Playground.tsx`, add:

```tsx
import { CodeDrawer } from './ui/CodeDrawer';
```

- [ ] **Step 2: Remove the inline CodeOutput**

Find the `<CodeOutput ... />` line near the bottom of the preview column (currently around line 416):

```tsx
        <CodeOutput config={{ format, template, title, description, author, tag, accent, font: fontEntry.name, titleSize, descSize, layout, gradient: gradient.slug, overlayOpacity, autoFit }} accent={accent} />
```

Delete that line.

- [ ] **Step 3: Remove the unused CodeOutput import**

Scroll to the top of Playground.tsx. Delete:

```tsx
import { CodeOutput } from './ui/CodeOutput';
```

(CodeOutput is now imported only inside CodeDrawer.)

- [ ] **Step 4: Make the preview column a positioning context**

The drawer uses `position: absolute` relative to its parent. The `.pg-preview-col` CSS class doesn't currently set `position: relative`. Open `docs/site/src/components/playground.css` and add `position: relative;` to the `.pg-preview-col` rule. The updated rule should read:

```css
.pg-preview-col {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
  max-height: calc(100dvh - var(--sl-nav-height, 60px));
}
```

- [ ] **Step 5: Insert the CodeDrawer at the end of the preview column**

Still in Playground.tsx, find the closing `</div>` of the preview column (the one that matches the `<div className="pg-preview-col">` opening tag). Just BEFORE that closing `</div>`, insert:

```tsx
        <CodeDrawer
          config={{ format, template, title, description, author, tag, accent, font: fontEntry.name, titleSize, descSize, layout, gradient: gradient.slug, overlayOpacity, autoFit }}
          accent={accent}
        />
```

Note the prop is the same config object literal that was previously passed to `<CodeOutput>` — just moved into `<CodeDrawer>`.

- [ ] **Step 6: Build**

Run: `cd docs/site && bun run build`
Expected: build succeeds.

- [ ] **Step 7: Visual smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Verify:
- The CodeOutput tabs no longer appear stacked below the canvas
- Instead, a "View code ↑" pill is visible at the bottom of the preview column
- Clicking "View code ↑" animates a drawer upward containing the curl/SDK/JSON tabs
- The drawer button now says "Hide code ↓" and clicking it collapses the drawer
- Pressing Escape with the drawer open closes it
- Opening FullscreenPreview with the drawer open, then pressing Escape, closes the fullscreen (not the drawer) — verifying the yield logic works
- Reload the page after opening the drawer — the drawer should still be open on reload (localStorage persistence)
- Reload again after closing it — the drawer should be closed
- All existing functionality intact: preview renders, download works, copy-code works inside the drawer, fullscreen works

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add docs/site/src/components/Playground.tsx \
        docs/site/src/components/playground.css
git commit -m "feat(playground): replace inline CodeOutput with CodeDrawer

Removes the stacked-below-preview CodeOutput block and replaces
it with the CodeDrawer component — collapsed by default, slides
up on demand, persists across reloads, closes on Escape unless
the fullscreen modal is open.

Refs spec B (drawer)."
```

---

## Task 9: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Build the production site**

Run: `cd docs/site && bun run build`
Expected: clean build, 38 pages, no warnings.

- [ ] **Step 2: Run the dev server and walk through acceptance criteria**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Walk through the Spec B acceptance criteria one by one:

- [ ] `/playground/` renders without the docs sidebar on the left
- [ ] Starlight global header still renders at top with working search, theme toggle, GitHub link
- [ ] At desktop ≥1024px, controls column is exactly 380px wide and the preview column fills the rest
- [ ] At tablet 768–1023px (resize browser), controls column is 340px wide
- [ ] At mobile <768px, preview stacks above controls and is the first thing visible
- [ ] Preview column does not scroll on desktop/tablet; controls column scrolls independently
- [ ] Format pills live in a toolbar above the preview, not in the controls column
- [ ] Render HUD chips render in the toolbar (not overlaying the canvas)
- [ ] Code drawer is collapsed by default (clear localStorage first with `localStorage.clear()` in DevTools console, then reload)
- [ ] "View code ↑" button toggles the drawer
- [ ] Pressing Escape closes the drawer
- [ ] Drawer open/closed state survives a page reload
- [ ] Surprise me CTA is sticky in the controls column (scroll the form; Surprise me stays visible)
- [ ] All Spec A behaviors still work: R keyboard shortcut, Auto-fit inline toggle, sidebar Try it badge (visible on other pages), contrast
- [ ] No console errors introduced
- [ ] Existing functionality: download PNG, fullscreen preview, drag-drop background images, accent picker, gradient picker, font picker, slider controls, preset cards

If any item fails, do NOT mark Task 9 complete — go back to the responsible task and fix.

- [ ] **Step 3: Done**

Task 9 is verification only. No commit. The branch is ready for review/merge.

---

## Self-review notes (kept for future reference)

- **Spec coverage:**
  - Shell: Tasks 1, 2 (splash template, two-column layout, breakpoints, sticky scroll)
  - Preview toolbar: Tasks 3, 4, 5 (HUD variant, PreviewToolbar component, wiring)
  - Sticky Surprise me: Task 6
  - Code drawer: Tasks 7, 8 (component with localStorage + Escape yield, wiring)
  - Verification: Task 9
- **Files:** matches the spec's Files Touched list (with one addition — Presets.tsx touched in Task 6 for the sticky wrapper).
- **Type consistency:**
  - `CodeDrawer` props `{ config, accent }` match the shape previously passed to `CodeOutput`.
  - `PreviewToolbar` props `{ format, onFormatChange, renderTime, info, accent }` — names match the underlying `FormatSelector` (`value`/`onChange`) and `RenderHUD` (`renderTime`/`info`/`accent`) props, with the toolbar forwarding appropriately.
  - `RenderHUD` `variant` defaults to `'toolbar'` — all existing and new call sites behave correctly.
- **No placeholders:** every step has exact paths, full code blocks, and expected outcomes.
- **Commit frequency:** 8 implementation commits (Tasks 1, 2, 3, 4, 5, 6, 7, 8). Each is independently revertable.
- **Risks from the spec addressed:**
  - Starlight header reuse → `template: splash` (Task 1) is the proven pattern.
  - Drawer vs FullscreenPreview conflict → Task 7's Escape handler checks `.pg-modal-backdrop` presence.
  - Mobile preview too tall → Task 2's CSS caps `.pg-preview-col .pg-canvas-wrapper` at `max-height: 50vh` on mobile.
  - `100vh` broken on iOS Safari → Task 2 uses `100dvh`.
  - Same `/playground/` URL → frontmatter change only; URL unchanged.
