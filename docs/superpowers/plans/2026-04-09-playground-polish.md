# Playground Polish (Spec A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the low-risk subset of playground improvements: sidebar reorder, hide unused TOC, fix WCAG AA contrast failures, promote the Randomize CTA, and move the Auto-fit toggle next to the Title size slider.

**Architecture:** Pure UI/CSS changes against the existing Astro + Starlight + React playground. No new dependencies, no new build steps. Contrast fixes use CSS custom properties referenced from inline styles via `var()`. Keyboard shortcut and CTA promotion live in the existing React tree. The implementation order isolates each change to its own commit so any single change can be reverted independently.

**Tech Stack:** Astro 5, Starlight, React 18, Bun, Biome (lint), tsc (typecheck), lefthook pre-commit (runs biome + tsc automatically — do not bypass).

**Spec:** `docs/superpowers/specs/2026-04-09-playground-polish-design.md`

**Working directory:** `docs/site` for all `bun` commands. Repo root for `git`.

---

## Conventions for every task

- All commits go on the current branch (`dev`). No branching needed for Spec A.
- The pre-commit hook automatically runs `biome check src/ tests/` and `tsc --noEmit`. Do not pass `--no-verify`. If a hook fails, fix the underlying issue and re-stage.
- After every code change, before committing: run `cd docs/site && bun run lint && bun run build` to catch issues early. (`build` is the strongest signal: it runs Astro's full type + content collection check.)
- For visual verification, run `cd docs/site && bun run dev` and open `http://localhost:4321/playground/`. Stop the dev server with Ctrl-C between tasks if needed.

---

## Task 1: Sidebar reorder

**Files:**
- Modify: `docs/site/astro.config.mjs:130-192`

- [ ] **Step 1: Open the file and locate the `sidebar:` array**

The current sidebar starts at line 130. The full array spans lines 130–192. You'll replace the entire array.

- [ ] **Step 2: Replace the sidebar array with the new order**

Replace lines 130–192 (the entire `sidebar: [ ... ],` block) with:

```js
      sidebar: [
        { label: 'Home', link: '/' },
        { label: 'Playground', link: '/playground/', badge: { text: 'Try it', variant: 'success' } },
        { label: 'Templates Gallery', link: '/templates/gallery/' },
        { label: 'Benchmarks', link: '/benchmarks/' },
        { label: 'Quick Start', link: '/quick-start/' },
        {
          label: 'Guides',
          items: [
            { label: 'Generating Images', link: '/guides/generating-images/' },
            { label: 'Formats & Templates', link: '/guides/formats-and-templates/' },
            { label: 'Customizing Styles', link: '/guides/customizing-styles/' },
            { label: 'Background Images', link: '/guides/background-images/' },
            { label: 'Text Validation', link: '/guides/text-validation/' },
            { label: 'Batch Rendering', link: '/guides/batch-rendering/' },
            { label: 'Error Handling', link: '/guides/error-handling/' },
            { label: 'Next.js Integration', link: '/guides/nextjs/' },
            { label: 'Astro Integration', link: '/guides/astro/' },
            { label: 'Cloudflare Workers', link: '/guides/cloudflare-workers/' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', link: '/api-reference/overview/' },
            { label: 'POST /render', link: '/api-reference/render/' },
            { label: 'POST /validate', link: '/api-reference/validate/' },
            { label: 'POST /render/batch', link: '/api-reference/batch/' },
            { label: 'GET /health', link: '/api-reference/health/' },
            { label: 'POST /auth/register', link: '/api-reference/register/' },
            { label: 'GET /usage', link: '/api-reference/usage/' },
            { label: 'Custom Templates', link: '/api-reference/templates/' },
            { label: 'Webhook Triggers', link: '/api-reference/triggers/' },
            { label: 'Errors', link: '/api-reference/errors/' },
          ],
        },
        {
          label: 'SDK',
          items: [
            { label: 'Installation', link: '/sdk/installation/' },
            { label: 'Reference', link: '/sdk/reference/' },
          ],
        },
        {
          label: 'Resources',
          items: [
            { label: 'Available Fonts', link: '/fonts/available-fonts/' },
            { label: 'OG Engine vs Puppeteer', link: '/compare/puppeteer/' },
            { label: 'Self-Hosting (Docker)', link: '/self-hosting/docker/' },
          ],
        },
        { label: 'Pricing', link: '/pricing/' },
        { label: 'Changelog', link: '/changelog/' },
        {
          label: 'Blog',
          items: [
            { label: 'All Posts', link: '/blog/' },
            { label: 'Why We Built OG Engine', link: '/blog/why-we-built-og-engine/' },
            { label: 'How Pretext Measures Text', link: '/blog/how-pretext-measures-text/' },
            { label: 'Multilingual OG Images', link: '/blog/multilingual-og-images/' },
          ],
        },
      ],
```

Key changes from the previous array:
- Playground promoted to slot 2 with a `success` badge
- Templates Gallery + Benchmarks promoted to slots 3 & 4
- Old `Compare` group dissolved (its single child `OG Engine vs Puppeteer` now lives in `Resources`)
- New `Resources` group containing: Available Fonts, OG Engine vs Puppeteer, Self-Hosting (Docker)
- Self-Hosting (Docker) and Available Fonts removed from root
- `Pricing & Limits` renamed to `Pricing`

- [ ] **Step 3: Build to confirm the badge variant is supported**

Run: `cd docs/site && bun run build`
Expected: build succeeds with no Starlight schema errors.

If you see a Zod schema error mentioning `badge.variant`, the installed Starlight version doesn't support the `success` variant. Fall back: change `variant: 'success'` to `variant: 'tip'`. Re-run the build.

- [ ] **Step 4: Visual smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/` in a browser.
Expected: the left sidebar shows the new order. Playground entry has a green "Try it" badge. Resources group is collapsible and contains the three expected entries.

Stop the dev server with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add docs/site/astro.config.mjs
git commit -m "feat(docs): reorder sidebar to surface playground and pricing

Promotes the highest-engagement pages (Playground, Templates,
Benchmarks) to the top, dissolves the single-child Compare group
into a new Resources group, and surfaces Pricing above the fold.

Refs spec A1."
```

---

## Task 2: Hide TOC on `/playground/`

**Files:**
- Modify: `docs/site/src/content/docs/playground.mdx:1-4`

- [ ] **Step 1: Add `tableOfContents: false` to the frontmatter**

Replace the existing frontmatter (lines 1–4):

```yaml
---
title: OG Image Playground
description: Build and preview OG images in real-time with the interactive playground. Edit title, description, styles, and formats — no API key or signup required.
---
```

with:

```yaml
---
title: OG Image Playground
description: Build and preview OG images in real-time with the interactive playground. Edit title, description, styles, and formats — no API key or signup required.
tableOfContents: false
---
```

- [ ] **Step 2: Build to confirm the frontmatter is valid**

Run: `cd docs/site && bun run build`
Expected: build succeeds; no schema errors on `playground.mdx`.

- [ ] **Step 3: Visual smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.
Expected: the right-hand "On this page" column is gone. The playground form/preview area now extends into the recovered space.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/playground.mdx
git commit -m "feat(docs): hide TOC on playground page

The page has no headings so the auto-generated TOC only ever
showed 'Overview'. Removing it recovers ~280px of horizontal
space for the playground itself.

Refs spec A2."
```

---

## Task 3: Contrast fixes — introduce token and replace failing colors

**Files:**
- Modify: `docs/site/src/components/playground.css` (add CSS variable + comment block)
- Modify: `docs/site/src/components/Playground.tsx` (replace inline `#475569` with `var(--pg-text-secondary)`)
- Modify: `docs/site/src/components/ui/Presets.tsx` (replace inline colors)
- Modify: `docs/site/src/components/ui/StyleControls.tsx` (replace inline colors in Slider/AccentPicker/FontPicker/LayoutPicker/GradientPicker)

The current code uses inline `color: '#475569'` (slate-600, ~2.64:1 contrast — fails WCAG AA) for label text in many places. We'll define a CSS variable once and reference it from inline styles via `var(--pg-text-secondary)`. This pattern works because React's `style` prop accepts strings, and the browser resolves the `var()` at paint time.

- [ ] **Step 1: Add the token to `playground.css`**

Open `docs/site/src/components/playground.css` and add this block at the very top of the file (before any existing rules):

```css
/*
 * Playground text color tokens.
 *
 * Use these for any new playground UI text. They were introduced to fix
 * WCAG AA contrast failures (slate-600 was 2.64:1 against the dark bg).
 *
 *   --pg-text-secondary  ~7:1   form labels, helper text, sublabels
 *   --pg-text-tertiary   ~9:1   icon-only buttons, key UI affordances
 *
 * Reference from inline React styles via var():
 *   style={{ color: 'var(--pg-text-secondary)' }}
 */
.pg-layout {
  --pg-text-secondary: #94a3b8; /* slate-400 */
  --pg-text-tertiary: #cbd5e1;  /* slate-300 */
}
```

- [ ] **Step 2: Replace inline colors in `Playground.tsx`**

In `docs/site/src/components/Playground.tsx`, replace every occurrence of `color: '#475569'` with `color: 'var(--pg-text-secondary)'`. As of the current file, this affects lines 196, 200, 204, 208, 216, 359 (the `RESPONSE HEADERS` label), and any others. Use editor find-and-replace scoped to this file.

Then, in the same file, replace these specific occurrences of `color: '#64748b'` (slate-500, also failing) with `color: 'var(--pg-text-secondary)'`:
- Line 349 (the "Remove background image" button)
- Line 368 (the response header key cell)
- Line 376 (the API mode caption row)
- Line 384 (the API/Client mode toggle button)

Leave `color: '#94a3b8'` occurrences (e.g., line 188, line 407) as-is — those are already passing values; we don't need to convert them in this pass. (Optional cleanup: convert them too for token consistency. Skip unless trivial.)

- [ ] **Step 3: Replace inline colors in `Presets.tsx`**

In `docs/site/src/components/ui/Presets.tsx`:

- Line 91: replace `color: '#475569'` with `color: 'var(--pg-text-secondary)'` (the "Quick Start" label)
- Line 101: replace `color: '#64748b'` with `color: 'var(--pg-text-secondary)'` (the Randomize button — this button will be removed entirely in Task 4, but fix it now for completeness in case Task 4 is delayed)
- Line 121: replace `color: '#475569'` with `color: 'var(--pg-text-secondary)'` (the preset card sublabel — currently nearly invisible)

Also on line 115, bump the preset card background and border for legibility:

```js
border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
```

(Was `border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)'`.)

- [ ] **Step 4: Replace inline colors in `StyleControls.tsx`**

In `docs/site/src/components/ui/StyleControls.tsx`, replace every `color: '#475569'` with `color: 'var(--pg-text-secondary)'`. This affects the label rows in `Slider` (line 14), `AccentPicker` (line 36), `FontPicker` (line 56), `LayoutPicker` (line 81), and `GradientPicker` (line 103).

Also replace these `color: '#64748b'` occurrences with `color: 'var(--pg-text-secondary)'`:
- Line 65 (FontPicker inactive button text)
- Line 90 (LayoutPicker inactive button text)

- [ ] **Step 5: Lint, typecheck, and build**

Run: `cd docs/site && bun run lint && bun run build`
Expected: zero errors. (Biome should accept the `var()` strings as plain string values.)

- [ ] **Step 6: Visual + contrast verification**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/` in a browser.

Verify by eye:
- The `TAG`, `TITLE`, `DESCRIPTION`, `AUTHOR`, `CUSTOM`, `ACCENT`, `FONT`, `LAYOUT`, `TITLE SIZE`, `DESCRIPTION SIZE`, `OVERLAY OPACITY`, `GRADIENT`, `RESPONSE HEADERS`, `QUICK START` labels are all clearly readable (light slate, not invisible dark grey).
- Preset cards (`Startup Launch`, `Blog Post`, `Event Invite`, `SaaS Feature`) show their sublabels (`Launch Day`, `Deep Dive`, `Conference`, `New Feature`) clearly.
- Inactive font/layout buttons text is legible.

Optional automated check: in Chrome DevTools console on `http://localhost:4321/playground/`, paste:

```js
(() => {
  const lum = (r,g,b) => { const a=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]; };
  const parse = s => s.match(/\d+/g).slice(0,3).map(Number);
  const ratio = (fg, bg) => { const [r1,g1,b1]=parse(fg),[r2,g2,b2]=parse(bg); const l1=lum(r1,g1,b1),l2=lum(r2,g2,b2); return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2); };
  const findBg = el => { let c=el; while(c){const b=getComputedStyle(c).backgroundColor; if(b&&b!=='rgba(0, 0, 0, 0)'&&b!=='transparent')return b; c=c.parentElement;} return 'rgb(0,0,0)'; };
  const fails = [];
  document.querySelectorAll('.pg-layout label, .pg-layout div').forEach(el => {
    const cs = getComputedStyle(el); const fg = cs.color; const bg = findBg(el);
    try { const r = parseFloat(ratio(fg, bg)); if (r < 4.5 && el.textContent.trim()) fails.push({txt: el.textContent.trim().slice(0,30), fg, ratio: r}); } catch {}
  });
  return fails.slice(0, 20);
})();
```

Expected: empty array, or only entries that are intentionally subtle decorative text (not the labels listed above). If any of the labels reappear, find the missed inline color and fix it.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add docs/site/src/components/playground.css \
        docs/site/src/components/Playground.tsx \
        docs/site/src/components/ui/Presets.tsx \
        docs/site/src/components/ui/StyleControls.tsx
git commit -m "fix(playground): bring text contrast up to WCAG AA

Introduces --pg-text-secondary / --pg-text-tertiary CSS tokens
on .pg-layout and replaces every inline slate-600/slate-500
label color with var(--pg-text-secondary). Bumps preset card
background opacity so sublabels are legible.

Resolves contrast failures found via Chrome DevTools audit
(form labels were 2.64:1; preset sublabels were ~1:1).

Refs spec A3."
```

---

## Task 4: Promote Randomize CTA + export randomPreset

**Files:**
- Modify: `docs/site/src/components/ui/Presets.tsx`

In this task we (a) export `randomPreset` so Task 5 can wire the keyboard shortcut, and (b) replace the small top-right Randomize button with a full-width "Surprise me" CTA above the preset cards.

- [ ] **Step 1: Export `randomPreset`**

In `docs/site/src/components/ui/Presets.tsx`, change line 66 from:

```ts
function randomPreset(): PresetData {
```

to:

```ts
export function randomPreset(): PresetData {
```

- [ ] **Step 2: Replace the Presets component body with the promoted CTA**

Replace the `Presets` component (currently lines 87–127) with:

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

Notes:
- The old top-right small Randomize button is gone (replaced by the full-width CTA).
- The preset card background/border bump from Task 3 is preserved.
- The `kbd` tag inside the button is the visual `R` shortcut hint — it's purely decorative; the actual keyboard listener lives in Task 5.

- [ ] **Step 3: Add a hover style for the new button**

In `docs/site/src/components/playground.css`, add at the bottom of the file:

```css
.pg-surprise-btn:hover {
  transform: scale(1.01);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
}
```

- [ ] **Step 4: Lint and build**

Run: `cd docs/site && bun run lint && bun run build`
Expected: no errors.

- [ ] **Step 5: Visual smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Verify:
- The "Quick Start" label still appears at the top of the form column.
- A full-width "🎲 Surprise me" button sits above the four preset cards, with an `R` kbd indicator on its right edge.
- Clicking the button randomizes the preview (accent color, gradient, font, layout, sizes).
- The four preset cards still work as before.
- Hovering the Surprise me button gives a subtle scale + shadow.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add docs/site/src/components/ui/Presets.tsx \
        docs/site/src/components/playground.css
git commit -m "feat(playground): promote Randomize to full-width Surprise me CTA

Replaces the small top-right Randomize button with a prominent
full-width 'Surprise me' button above the preset cards, with an
R keyboard shortcut hint. Exports randomPreset for the keyboard
listener wired in the next commit.

Refs spec A4."
```

---

## Task 5: Wire `R` keyboard shortcut in Playground

**Files:**
- Modify: `docs/site/src/components/Playground.tsx` (add import + useEffect)

- [ ] **Step 1: Update the import from `./ui/Presets`**

Find line 12:

```ts
import { Presets, type PresetData } from './ui/Presets';
```

Replace with:

```ts
import { Presets, randomPreset, type PresetData } from './ui/Presets';
```

- [ ] **Step 2: Add a keyboard listener `useEffect`**

Find the existing `applyPreset` callback (currently lines 109–121, ends with `}, []);`). Immediately AFTER the closing `}, []);` of `applyPreset`, add:

```ts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      e.preventDefault();
      applyPreset(randomPreset());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyPreset]);
```

This guards against:
- Modifier keys (so `Cmd+R` browser refresh still works)
- Typing "r" inside an input/textarea/select/contenteditable

- [ ] **Step 3: Lint and build**

Run: `cd docs/site && bun run lint && bun run build`
Expected: no errors. Biome may flag the inline `tag === 'INPUT'` chain — if so, leave as-is (it's the most readable form for a 3-tag whitelist).

If TypeScript complains that `applyPreset` is referenced before declaration, the `useEffect` was inserted in the wrong spot — it must be AFTER the `const applyPreset = useCallback(...)` block.

- [ ] **Step 4: Functional smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Test:
1. Click anywhere on the page background (NOT in an input). Press `R`. Expected: the preview randomizes (new colors, font, layout).
2. Click into the Title input. Type `r`. Expected: the letter `r` appears in the title; the preview does NOT randomize.
3. Press `Cmd+R` (or `Ctrl+R` on Linux). Expected: the browser reloads the page normally (our listener does not interfere).
4. Press `Shift+R`. Expected: nothing happens (no randomize, no error in console).

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/components/Playground.tsx
git commit -m "feat(playground): add R keyboard shortcut for Surprise me

Listens on window keydown and triggers randomPreset when R is
pressed without modifiers and outside any text input.

Refs spec A4."
```

---

## Task 6: Move Auto-fit toggle next to the Title size slider

**Files:**
- Modify: `docs/site/src/components/ui/StyleControls.tsx` (extend `Slider` with optional `right` slot)
- Modify: `docs/site/src/components/Playground.tsx` (move the Auto-fit checkbox into the Title size Slider's `right` prop, remove the old block from Fine-tuning)

The Auto-fit checkbox currently lives at the bottom of the form inside `<Section title="Fine-tuning">`. Users tweaking title size won't notice it. We move it into the Title size slider's label row. Cleanest implementation: add an optional `right?: ReactNode` prop to `Slider` that renders inline next to the label.

Note: the Fine-tuning section also contains the Overlay opacity slider, so we keep the section.

- [ ] **Step 1: Extend the `Slider` component with an optional `right` slot**

In `docs/site/src/components/ui/StyleControls.tsx`, replace the `SliderProps` interface and `Slider` function (currently lines 4–30) with:

```tsx
import type { ReactNode } from 'react';
import { ACCENTS, GRADIENTS, type Gradient } from '../engine/gradients';
import { FONTS, type FontEntry } from '../engine/fonts';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  accent: string;
  /** Optional content rendered inline next to the label (e.g., an inline toggle). */
  right?: ReactNode;
}

export function Slider({ label, value, onChange, min, max, accent, right }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const sliderId = `pg-slider-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: 'var(--pg-text-secondary)', marginBottom: 3, gap: 8 }}>
        <label htmlFor={sliderId} style={{ letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {right}
          <span style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
      </div>
      <input type="range" id={sliderId} min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="pg-input"
        style={{
          width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
          background: `linear-gradient(90deg, ${accent}44 ${pct}%, rgba(255,255,255,0.06) 0%)`,
          borderRadius: 2, outline: 'none', cursor: 'pointer',
        }}
      />
    </div>
  );
}
```

Note: the existing top-level `import` of `ACCENTS, GRADIENTS, type Gradient` from `../engine/gradients` and `FONTS, type FontEntry` from `../engine/fonts` is preserved. We add `import type { ReactNode } from 'react';` at the top.

(If the file already imports anything from `react`, merge into a single import. Currently it does not.)

- [ ] **Step 2: Update the Title size slider call site in Playground.tsx**

In `docs/site/src/components/Playground.tsx`, find the Typography section (currently around line 251):

```tsx
        <Section title="Typography">
          <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
          <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
          <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
          <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
        </Section>
```

Replace the `<Slider label="Title size" ... />` line with:

```tsx
          <Slider
            label="Title size"
            value={titleSize}
            onChange={setTitleSize}
            min={28}
            max={72}
            accent={accent}
            right={
              <label
                htmlFor="pg-autofit"
                title="Shrinks title size automatically to prevent overflow"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  fontSize: 9, color: 'var(--pg-text-secondary)',
                  letterSpacing: 1, textTransform: 'uppercase',
                }}
              >
                <input
                  id="pg-autofit"
                  type="checkbox"
                  checked={autoFit}
                  onChange={(e) => setAutoFit(e.target.checked)}
                  style={{ accentColor: accent, cursor: 'pointer', margin: 0 }}
                />
                <span style={{ color: autoFit ? accent : 'var(--pg-text-secondary)' }}>Auto-fit</span>
              </label>
            }
          />
```

- [ ] **Step 3: Remove the old Auto-fit block from the Fine-tuning section**

In the same file, find the Fine-tuning section (currently around lines 258–290):

```tsx
        <Section title="Fine-tuning">
          <Slider
            label="Overlay opacity"
            value={Math.round(overlayOpacity * 100)}
            onChange={(v) => setOverlayOpacity(v / 100)}
            min={20}
            max={90}
            accent={accent}
          />
          <div style={{ marginTop: 8 }}>
            <label
              htmlFor="pg-autofit"
              ...
            >
              ...
            </label>
          </div>
        </Section>
```

Remove the entire `<div style={{ marginTop: 8 }}> ... </div>` block (the Auto-fit checkbox wrapper). Keep the Overlay opacity Slider — Fine-tuning remains a meaningful section. The result should be:

```tsx
        <Section title="Fine-tuning">
          <Slider
            label="Overlay opacity"
            value={Math.round(overlayOpacity * 100)}
            onChange={(v) => setOverlayOpacity(v / 100)}
            min={20}
            max={90}
            accent={accent}
          />
        </Section>
```

- [ ] **Step 4: Lint, typecheck, and build**

Run: `cd docs/site && bun run lint && bun run build`
Expected: no errors. There must be exactly ONE element with `id="pg-autofit"` after this change — if biome or Astro complain about a duplicate id, the old block wasn't removed cleanly.

- [ ] **Step 5: Functional smoke test**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Verify:
- The Typography section's "TITLE SIZE" row now shows the Auto-fit checkbox + label between the title text and the numeric value.
- Toggling the Auto-fit checkbox still affects rendering as before (toggle on, set a very long title — it should shrink; toggle off — it should overflow).
- Hovering the Auto-fit label shows the tooltip "Shrinks title size automatically to prevent overflow".
- The Fine-tuning section still shows Overlay opacity but no longer has the Auto-fit checkbox.
- No `Description size` regression.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add docs/site/src/components/ui/StyleControls.tsx \
        docs/site/src/components/Playground.tsx
git commit -m "feat(playground): inline Auto-fit toggle next to Title size slider

Adds an optional right-slot prop to Slider and uses it to host
the Auto-fit checkbox directly in the Title size slider's label
row, where users tweaking the title size will actually look for
it. Removes the old Fine-tuning entry; description text becomes
a hover tooltip.

Refs spec A5."
```

---

## Task 7: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Build the production site**

Run: `cd docs/site && bun run build`
Expected: clean build, no warnings about duplicate ids, badge variants, or missing routes.

- [ ] **Step 2: Run the dev server and walk through the spec acceptance criteria**

Run: `cd docs/site && bun run dev`
Open `http://localhost:4321/playground/`.

Walk through the spec's Acceptance Criteria one by one:

- [ ] Sidebar shows the new order on desktop (resize the window or open in mobile emulator) and mobile.
- [ ] `/playground/` page renders with no right-hand TOC column.
- [ ] All previously failing labels (`TAG`, `TITLE`, `AUTHOR`, slider labels, preset sublabels) are clearly readable.
- [ ] "Surprise me" CTA is full-width above preset cards. The `R` keyboard shortcut works outside inputs and is suppressed inside them.
- [ ] Auto-fit checkbox sits next to the Title size slider; toggling it still works.
- [ ] No console errors.
- [ ] Existing functionality intact: download PNG works, code copy buttons work (curl/SDK/JSON), fullscreen preview opens.

If any item fails, do NOT mark Task 7 complete — go back to the responsible task and fix.

- [ ] **Step 3: Done**

No final commit — Task 7 is verification only. The branch is now ready for review/merge.

---

## Self-review notes (kept for future reference)

- **Spec coverage:** Each section A1–A5 maps to a task (1, 2, 3, 4+5, 6). Verification (A1–A5 acceptance criteria) lives in Task 7.
- **Type consistency:** `randomPreset` exported from `Presets.tsx` (Task 4) and imported in `Playground.tsx` (Task 5). `Slider`'s `right?: ReactNode` prop introduced in Task 6 and used immediately in the same task.
- **No placeholders:** Every step has exact paths, exact code, and an expected outcome.
- **Frequency of commits:** 6 commits (one per implementation task). Each commit is independently revertable.
- **Risks acknowledged:** Starlight badge variant fallback in Task 1 Step 3. CSS specificity not expected to be an issue because we use inline `var()` references rather than CSS overrides.
