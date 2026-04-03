# OG Engine Documentation Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Starlight documentation site with interactive Canvas playground, all content pages, OpenAPI spec, and custom dark theme — before any API code is written.

**Architecture:** Astro + Starlight for the static docs framework. React islands for interactive playground components. Client-side Canvas rendering engine ported from the POC (`docs/analysis/og-engine.jsx`). OpenAPI 3.1 spec hand-written as static JSON.

**Tech Stack:** Astro 5.x, @astrojs/starlight, @astrojs/react, React 19, TypeScript 5.x, Canvas API

**Design Spec:** `docs/superpowers/specs/2026-04-03-documentation-design.md`

---

## File Map

### New files to create

```
docs/site/
├── astro.config.mjs              # Starlight + React integration config
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── public/
│   └── openapi.json               # OpenAPI 3.1 spec
├── src/
│   ├── assets/
│   │   └── logo.svg               # Placeholder logo
│   ├── styles/
│   │   └── custom.css             # Dark theme overrides
│   ├── content/
│   │   └── docs/
│   │       ├── index.mdx                        # Home / hero page
│   │       ├── quick-start.mdx                  # 5-step quick start
│   │       ├── guides/
│   │       │   ├── generating-images.mdx
│   │       │   ├── formats-and-templates.mdx
│   │       │   ├── customizing-styles.mdx
│   │       │   ├── background-images.mdx
│   │       │   ├── text-validation.mdx
│   │       │   ├── batch-rendering.mdx
│   │       │   └── error-handling.mdx
│   │       ├── api-reference/
│   │       │   ├── overview.mdx
│   │       │   ├── render.mdx
│   │       │   ├── validate.mdx
│   │       │   ├── batch.mdx
│   │       │   ├── health.mdx
│   │       │   └── errors.mdx
│   │       ├── sdk/
│   │       │   ├── installation.mdx
│   │       │   └── reference.mdx
│   │       ├── templates/
│   │       │   └── gallery.mdx
│   │       ├── fonts/
│   │       │   └── available-fonts.mdx
│   │       ├── self-hosting/
│   │       │   └── docker.mdx
│   │       ├── playground.mdx
│   │       ├── pricing.mdx
│   │       └── changelog.mdx
│   └── components/
│       ├── engine/
│       │   ├── formats.ts
│       │   ├── gradients.ts
│       │   ├── text-measure.ts
│       │   ├── fonts.ts
│       │   └── canvas-renderer.ts
│       ├── ui/
│       │   ├── FormatSelector.tsx
│       │   ├── StyleControls.tsx
│       │   ├── TemplateSelector.tsx
│       │   ├── CodeOutput.tsx
│       │   └── JsonEditor.tsx
│       ├── PlaygroundMini.tsx
│       ├── PlaygroundContextual.tsx
│       └── Playground.tsx
```

---

## Task 1: Scaffold Starlight Project

**Files:**
- Create: `docs/site/package.json`
- Create: `docs/site/astro.config.mjs`
- Create: `docs/site/tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "og-engine-docs",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^5.7.10",
    "@astrojs/starlight": "^0.34.4",
    "@astrojs/react": "^4.2.1",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 3: Create astro.config.mjs**

```javascript
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://og-engine.com',
  integrations: [
    starlight({
      title: 'OG Engine',
      description: 'Generate images in 2ms. No browser required.',
      logo: {
        src: './src/assets/logo.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/phmatray/og-engine' },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Home', link: '/' },
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
        { label: 'Templates Gallery', link: '/templates/gallery/' },
        { label: 'Available Fonts', link: '/fonts/available-fonts/' },
        { label: 'Self-Hosting (Docker)', link: '/self-hosting/docker/' },
        { label: 'Playground', link: '/playground/' },
        { label: 'Pricing & Limits', link: '/pricing/' },
        { label: 'Changelog', link: '/changelog/' },
      ],
    }),
    react(),
  ],
});
```

- [ ] **Step 4: Install dependencies**

Run: `cd docs/site && npm install`

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Create placeholder index page to verify the build**

Create `docs/site/src/content/docs/index.mdx`:

```mdx
---
title: OG Engine
description: Generate images in 2ms. No browser required.
template: splash
hero:
  tagline: Server-side image generation API. Send JSON, get back a PNG. Replaces Puppeteer at 500x the speed.
  actions:
    - text: Get Started Free
      link: /quick-start/
      icon: right-arrow
    - text: Try the Playground
      link: /playground/
      variant: minimal
---
```

- [ ] **Step 6: Verify the site builds**

Run: `cd docs/site && npm run build`

Expected: Build succeeds with output in `dist/`.

- [ ] **Step 7: Commit**

```bash
git add docs/site/package.json docs/site/astro.config.mjs docs/site/tsconfig.json docs/site/src/content/docs/index.mdx docs/site/package-lock.json
git commit -m "feat(docs): scaffold Starlight site with sidebar config"
```

---

## Task 2: Custom Dark Theme & Logo

**Files:**
- Create: `docs/site/src/styles/custom.css`
- Create: `docs/site/src/assets/logo.svg`

- [ ] **Step 1: Create the logo SVG**

A simple lightning bolt icon that works at small sizes:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#38ef7d" fill-opacity="0.15"/>
  <path d="M18 4L8 18h6l-2 10 10-14h-6l2-10z" fill="#38ef7d"/>
</svg>
```

- [ ] **Step 2: Create custom.css**

Starlight exposes CSS custom properties for theming. Override them for the dark-only, green-accent design:

```css
/* docs/site/src/styles/custom.css */

/* Force dark mode only */
:root {
  color-scheme: dark;
}

/* Accent color: #38ef7d green */
:root,
[data-theme='dark'] {
  --sl-color-accent-low: #0d3320;
  --sl-color-accent: #38ef7d;
  --sl-color-accent-high: #a8f5c8;

  --sl-color-bg-nav: #06080c;
  --sl-color-bg: #080a10;
  --sl-color-bg-sidebar: #06080c;

  --sl-color-white: #f1f5f9;
  --sl-color-gray-1: #e2e8f0;
  --sl-color-gray-2: #94a3b8;
  --sl-color-gray-3: #475569;
  --sl-color-gray-4: #1e293b;
  --sl-color-gray-5: #0f172a;
  --sl-color-gray-6: #06080c;
  --sl-color-black: #020205;

  --sl-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --sl-font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  --sl-content-width: 55rem;
}

/* Hide light mode toggle */
starlight-theme-select {
  display: none;
}

/* Code blocks - void gradient background */
pre:has(code) {
  background: #0c0f1a !important;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* Sidebar active item glow */
nav[aria-label='Main'] a[aria-current='page'] {
  box-shadow: inset 2px 0 0 #38ef7d;
}

/* Links */
a:not([class]) {
  color: #38ef7d;
}
a:not([class]):hover {
  color: #a8f5c8;
}

/* Import Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
```

- [ ] **Step 3: Verify the site builds with the theme**

Run: `cd docs/site && npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/styles/custom.css docs/site/src/assets/logo.svg
git commit -m "feat(docs): add dark theme with green accent and logo"
```

---

## Task 3: Engine — Formats & Gradients Data Modules

**Files:**
- Create: `docs/site/src/components/engine/formats.ts`
- Create: `docs/site/src/components/engine/gradients.ts`

- [ ] **Step 1: Create formats.ts**

```typescript
// docs/site/src/components/engine/formats.ts

export interface Format {
  w: number;
  h: number;
  label: string;
  ratio: string;
  maxTitleLines: number;
  maxDescLines: number;
}

export const FORMATS: Record<string, Format> = {
  og: { w: 1200, h: 630, label: 'OG', ratio: '1200x630', maxTitleLines: 3, maxDescLines: 4 },
  twitter: { w: 1200, h: 675, label: 'Twitter', ratio: '1200x675', maxTitleLines: 3, maxDescLines: 4 },
  square: { w: 1080, h: 1080, label: 'Square', ratio: '1080x1080', maxTitleLines: 4, maxDescLines: 5 },
  linkedin: { w: 1200, h: 627, label: 'LinkedIn', ratio: '1200x627', maxTitleLines: 3, maxDescLines: 4 },
  story: { w: 1080, h: 1920, label: 'Story', ratio: '1080x1920', maxTitleLines: 5, maxDescLines: 6 },
};

export type FormatKey = keyof typeof FORMATS;
export const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[];
```

- [ ] **Step 2: Create gradients.ts**

```typescript
// docs/site/src/components/engine/gradients.ts

export interface Gradient {
  name: string;
  slug: string;
  stops: [string, string];
}

export const GRADIENTS: Gradient[] = [
  { name: 'Void', slug: 'void', stops: ['#0c0f1a', '#080a12'] },
  { name: 'Deep Sea', slug: 'deep-sea', stops: ['#0a1628', '#061220'] },
  { name: 'Ember', slug: 'ember', stops: ['#1a0a0a', '#120808'] },
  { name: 'Forest', slug: 'forest', stops: ['#0a1a10', '#061208'] },
  { name: 'Plum', slug: 'plum', stops: ['#150a1a', '#0e0812'] },
  { name: 'Slate', slug: 'slate', stops: ['#12141a', '#0a0c10'] },
];

export const ACCENTS = [
  '#38ef7d', '#67e8f9', '#c4b5fd', '#fbbf24',
  '#fb7185', '#fb923c', '#e2e8f0', '#a3e635',
];
```

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/components/engine/formats.ts docs/site/src/components/engine/gradients.ts
git commit -m "feat(docs): add format dimensions and gradient presets"
```

---

## Task 4: Engine — Text Measurement

**Files:**
- Create: `docs/site/src/components/engine/text-measure.ts`

- [ ] **Step 1: Create text-measure.ts**

Direct TypeScript port of the POC's `measureLines()` and `tw()` functions:

```typescript
// docs/site/src/components/engine/text-measure.ts

export interface MeasuredLine {
  text: string;
  width: number;
}

let _ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D {
  if (!_ctx) {
    const c = document.createElement('canvas');
    _ctx = c.getContext('2d')!;
  }
  return _ctx;
}

/**
 * Measures text and splits it into lines that fit within maxWidth.
 * Handles paragraph breaks (\n) and word wrapping.
 */
export function measureLines(text: string, font: string, maxWidth: number): MeasuredLine[] {
  if (!text || maxWidth <= 0) return [];
  const ctx = getCtx();
  ctx.font = font;
  const lines: MeasuredLine[] = [];

  for (const para of text.split('\n')) {
    if (!para.trim()) {
      lines.push({ text: '', width: 0 });
      continue;
    }
    let cur = '';
    let curW = 0;
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const ww = ctx.measureText(word).width;
      const sp = cur ? ctx.measureText(' ').width : 0;
      if (curW + sp + ww > maxWidth && cur) {
        lines.push({ text: cur, width: curW });
        cur = word;
        curW = ww;
      } else {
        cur += (cur ? ' ' : '') + word;
        curW += sp + ww;
      }
    }
    if (cur) lines.push({ text: cur, width: curW });
  }

  return lines;
}

/**
 * Measures the width of a single text string in a given font.
 */
export function measureTextWidth(text: string, font: string): number {
  const ctx = getCtx();
  ctx.font = font;
  return ctx.measureText(text).width;
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/engine/text-measure.ts
git commit -m "feat(docs): add text measurement engine (Canvas-based)"
```

---

## Task 5: Engine — Font Loading

**Files:**
- Create: `docs/site/src/components/engine/fonts.ts`

- [ ] **Step 1: Create fonts.ts**

```typescript
// docs/site/src/components/engine/fonts.ts

export interface FontEntry {
  name: string;
  family: string;
  google: string | null;
  weights: number[];
  scripts: string[];
}

export const FONTS: FontEntry[] = [
  {
    name: 'Outfit',
    family: "'Outfit', sans-serif",
    google: 'Outfit:wght@400;700;800',
    weights: [400, 700, 800],
    scripts: ['Latin'],
  },
  {
    name: 'Inter',
    family: "'Inter', sans-serif",
    google: 'Inter:wght@400;700;800',
    weights: [400, 700, 800],
    scripts: ['Latin'],
  },
  {
    name: 'Playfair Display',
    family: "'Playfair Display', serif",
    google: 'Playfair+Display:wght@400;700;800',
    weights: [400, 700, 800],
    scripts: ['Latin'],
  },
  {
    name: 'Sora',
    family: "'Sora', sans-serif",
    google: 'Sora:wght@400;700;800',
    weights: [400, 700, 800],
    scripts: ['Latin'],
  },
  {
    name: 'Space Grotesk',
    family: "'Space Grotesk', sans-serif",
    google: 'Space+Grotesk:wght@400;700',
    weights: [400, 700],
    scripts: ['Latin'],
  },
  {
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', monospace",
    google: 'JetBrains+Mono:wght@400;700',
    weights: [400, 700],
    scripts: ['Latin'],
  },
  {
    name: 'Noto Sans JP',
    family: "'Noto Sans JP', sans-serif",
    google: 'Noto+Sans+JP:wght@400;700',
    weights: [400, 700],
    scripts: ['Latin', 'CJK'],
  },
  {
    name: 'Noto Sans AR',
    family: "'Noto Sans Arabic', sans-serif",
    google: 'Noto+Sans+Arabic:wght@400;700',
    weights: [400, 700],
    scripts: ['Latin', 'Arabic'],
  },
];

const loadedFonts = new Set<string>();

/**
 * Loads a Google Font by appending a <link> tag to <head>.
 * Idempotent — calling multiple times for the same font is safe.
 */
export function loadGoogleFont(entry: FontEntry): void {
  if (!entry.google || loadedFonts.has(entry.name)) return;
  loadedFonts.add(entry.name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${entry.google}&display=swap`;
  document.head.appendChild(link);
}

/**
 * Returns a FontEntry by its API name, or the default (Outfit).
 */
export function getFontByName(name: string): FontEntry {
  return FONTS.find((f) => f.name === name) ?? FONTS[0];
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/engine/fonts.ts
git commit -m "feat(docs): add font registry with Google Fonts loader"
```

---

## Task 6: Engine — Canvas Renderer

**Files:**
- Create: `docs/site/src/components/engine/canvas-renderer.ts`

This is the core rendering function, ported from the POC's `renderCard()`. It draws the full OG image onto a Canvas.

- [ ] **Step 1: Create canvas-renderer.ts**

```typescript
// docs/site/src/components/engine/canvas-renderer.ts

import { measureLines, measureTextWidth } from './text-measure';
import { FORMATS, type FormatKey } from './formats';
import { GRADIENTS, type Gradient } from './gradients';
import type { FontEntry } from './fonts';

export interface RenderOptions {
  title: string;
  description: string;
  author: string;
  tag: string;
  format: FormatKey;
  accent: string;
  layout: 'left' | 'center' | 'bottom';
  titleSize: number;
  descSize: number;
  fontEntry: FontEntry;
  gradient: Gradient;
  bgImage: HTMLImageElement | null;
  overlayOpacity: number;
}

export interface RenderResult {
  titleTotalLines: number;
  titleVisibleLines: number;
  descTotalLines: number;
  descVisibleLines: number;
  overflow: boolean;
}

export function renderCard(canvas: HTMLCanvasElement, options: RenderOptions): RenderResult {
  const {
    title, description, author, tag, format, accent, layout,
    titleSize, descSize, fontEntry, gradient, bgImage, overlayOpacity,
  } = options;

  const fmt = FORMATS[format];
  const W = fmt.w;
  const H = fmt.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const s = Math.max(W, H) / 1200;
  const ff = fontEntry.family;

  // Background: image or gradient
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, W, H);
    ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
    bg.addColorStop(0, gradient.stops[0]);
    bg.addColorStop(1, gradient.stops[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // Grid
  ctx.strokeStyle = accent + '05';
  ctx.lineWidth = 1;
  const gs = 50 * s;
  for (let x = 0; x < W; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += gs) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Glow
  const g1 = ctx.createRadialGradient(W * 0.15, H * 0.8, 0, W * 0.15, H * 0.8, W * 0.35);
  g1.addColorStop(0, accent + '10');
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  // Layout metrics
  const px = Math.round(64 * s);
  const cW = W - px * 2;
  const isCenter = layout === 'center';
  const isBottom = layout === 'bottom';

  // Tag
  const tagFont = `600 ${Math.round(14 * s)}px ${ff}`;
  let tagH = 0;
  if (tag) tagH = 28 * s + 16 * s;

  // Title
  const tFont = `800 ${Math.round(titleSize * s)}px ${ff}`;
  const tLH = Math.round(titleSize * 1.2 * s);
  const tLines = measureLines(title || 'Untitled', tFont, cW);
  const maxT = fmt.maxTitleLines;
  const visibleT = tLines.slice(0, maxT);

  // Description
  const dFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const dLH = Math.round(descSize * 1.55 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const maxD = fmt.maxDescLines;
  const visibleD = dLines.slice(0, maxD);

  // Author
  const aFont = `700 ${Math.round(18 * s)}px ${ff}`;
  const aH = 24 * s;
  const g3v = 20 * s;
  const g4v = 28 * s;
  const totalH = tagH + visibleT.length * tLH + g3v + visibleD.length * dLH + g4v + aH;

  let y = isBottom ? H - px - totalH : isCenter ? (H - totalH) / 2 : Math.round(px * 1.2);
  const align: CanvasTextAlign = isCenter ? 'center' : 'left';
  const xP = isCenter ? W / 2 : px;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  // Accent bar
  if (!isCenter && !bgImage) {
    ctx.fillStyle = accent;
    ctx.fillRect(px, y, 4 * s, Math.min(visibleT.length * tLH + tagH, 80 * s));
  }

  // Tag pill
  if (tag) {
    ctx.font = tagFont;
    const tagText = tag.toUpperCase();
    const tgW = measureTextWidth(tagText, tagFont);
    const pW = tgW + 24 * s;
    const pH = 28 * s;
    const pX = isCenter ? (W - pW) / 2 : px;
    ctx.fillStyle = accent + '18';
    ctx.beginPath();
    ctx.roundRect(pX, y, pW, pH, pH / 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = tagFont;
    ctx.textAlign = 'center';
    ctx.fillText(tagText, pX + pW / 2, y + pH / 2 - 7 * s);
    ctx.textAlign = align;
    y += tagH;
  }

  // Title lines
  ctx.fillStyle = '#f1f5f9';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '\u2026';
    ctx.fillText(t, xP, y);
    y += tLH;
  }
  y += g3v;

  // Description lines
  ctx.fillStyle = bgImage ? '#d1d5db' : '#94a3b8';
  ctx.font = dFont;
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > maxD) t += '\u2026';
    ctx.fillText(t, xP, y);
    y += dLH;
  }
  y += g4v;

  // Author
  ctx.fillStyle = accent;
  ctx.font = aFont;
  ctx.fillText(author || '', xP, y);

  // Badge
  ctx.fillStyle = accent + '33';
  ctx.font = `500 ${Math.round(12 * s)}px ui-monospace, monospace`;
  ctx.textAlign = 'right';
  ctx.fillText('\u26A1 no browser required', W - px, H - px * 0.7);
  ctx.textAlign = 'left';

  // Frame
  ctx.strokeStyle = accent + '12';
  ctx.lineWidth = 1;
  const fr = 24 * s;
  ctx.strokeRect(fr, fr, W - fr * 2, H - fr * 2);

  const overflow = tLines.length > maxT || dLines.length > maxD;

  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
}
```

- [ ] **Step 2: Verify the build still passes**

Run: `cd docs/site && npm run build`

Expected: Build succeeds. These are `.ts` files imported only by React client components, so they won't be bundled until a component uses them.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/components/engine/canvas-renderer.ts
git commit -m "feat(docs): add Canvas rendering engine (ported from POC)"
```

---

## Task 7: UI Components — FormatSelector, StyleControls, TemplateSelector

**Files:**
- Create: `docs/site/src/components/ui/FormatSelector.tsx`
- Create: `docs/site/src/components/ui/StyleControls.tsx`
- Create: `docs/site/src/components/ui/TemplateSelector.tsx`

- [ ] **Step 1: Create FormatSelector.tsx**

```tsx
// docs/site/src/components/ui/FormatSelector.tsx
import { FORMATS, FORMAT_KEYS, type FormatKey } from '../engine/formats';

interface Props {
  value: FormatKey;
  onChange: (value: FormatKey) => void;
  accent: string;
}

export function FormatSelector({ value, onChange, accent }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {FORMAT_KEYS.map((key) => {
        const fmt = FORMATS[key];
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontFamily: 'inherit',
              border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
              background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
              color: active ? accent : '#64748b',
              cursor: 'pointer',
              letterSpacing: 0.5,
              whiteSpace: 'nowrap',
            }}
          >
            {fmt.label} <span style={{ opacity: 0.6, fontSize: 9 }}>{fmt.ratio}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create StyleControls.tsx**

```tsx
// docs/site/src/components/ui/StyleControls.tsx
import { ACCENTS } from '../engine/gradients';
import { GRADIENTS, type Gradient } from '../engine/gradients';
import { FONTS, type FontEntry } from '../engine/fonts';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  accent: string;
}

export function Slider({ label, value, onChange, min, max, accent }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginBottom: 3 }}>
        <span style={{ letterSpacing: 2, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
          background: `linear-gradient(90deg, ${accent}44 ${pct}%, rgba(255,255,255,0.06) 0%)`,
          borderRadius: 2, outline: 'none', cursor: 'pointer',
        }}
      />
    </div>
  );
}

interface AccentPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function AccentPicker({ value, onChange }: AccentPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Accent</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {ACCENTS.map((hex) => (
          <button
            key={hex}
            onClick={() => onChange(hex)}
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: hex + '22',
              border: value === hex ? `2px solid ${hex}` : '2px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 3, background: hex }} />
          </button>
        ))}
      </div>
    </div>
  );
}

interface FontPickerProps {
  value: FontEntry;
  onChange: (value: FontEntry) => void;
  accent: string;
}

export function FontPicker({ value, onChange, accent }: FontPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Font</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {FONTS.map((f) => {
          const active = value.name === f.name;
          return (
            <button
              key={f.name}
              onClick={() => onChange(f)}
              style={{
                padding: '5px 8px', borderRadius: 6, fontSize: 9, fontFamily: 'inherit',
                border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
                background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
                color: active ? accent : '#64748b',
                cursor: 'pointer', letterSpacing: 0.5, whiteSpace: 'nowrap',
              }}
            >
              {f.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface LayoutPickerProps {
  value: 'left' | 'center' | 'bottom';
  onChange: (value: 'left' | 'center' | 'bottom') => void;
  accent: string;
}

export function LayoutPicker({ value, onChange, accent }: LayoutPickerProps) {
  const options: Array<{ key: 'left' | 'center' | 'bottom'; label: string }> = [
    { key: 'left', label: 'Left' },
    { key: 'center', label: 'Center' },
    { key: 'bottom', label: 'Bottom' },
  ];
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Layout</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {options.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
                border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
                background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
                color: active ? accent : '#64748b',
                cursor: 'pointer', letterSpacing: 0.5,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface GradientPickerProps {
  value: Gradient;
  onChange: (value: Gradient) => void;
  accent: string;
}

export function GradientPicker({ value, onChange, accent }: GradientPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Gradient</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {GRADIENTS.map((g) => (
          <button
            key={g.slug}
            onClick={() => onChange(g)}
            title={g.name}
            style={{
              width: 40, height: 28, borderRadius: 6, cursor: 'pointer', padding: 0,
              background: `linear-gradient(135deg, ${g.stops[0]}, ${g.stops[1]})`,
              border: value.slug === g.slug ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create TemplateSelector.tsx**

```tsx
// docs/site/src/components/ui/TemplateSelector.tsx

interface Template {
  key: string;
  label: string;
  description: string;
}

const TEMPLATES: Template[] = [
  { key: 'default', label: 'Default', description: 'Accent bar, grid, tag pill' },
  { key: 'social-card', label: 'Social Card', description: 'Large centered title' },
  { key: 'blog-hero', label: 'Blog Hero', description: 'Background image overlay' },
  { key: 'email-banner', label: 'Email Banner', description: 'Horizontal CTA-style' },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  accent: string;
}

export function TemplateSelector({ value, onChange, accent }: Props) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Template</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TEMPLATES.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
                border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
                background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
                color: active ? accent : '#64748b',
                cursor: 'pointer', letterSpacing: 0.5, whiteSpace: 'nowrap',
              }}
              title={t.description}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/ui/FormatSelector.tsx docs/site/src/components/ui/StyleControls.tsx docs/site/src/components/ui/TemplateSelector.tsx
git commit -m "feat(docs): add UI components for playground controls"
```

---

## Task 8: UI Components — CodeOutput & JsonEditor

**Files:**
- Create: `docs/site/src/components/ui/CodeOutput.tsx`
- Create: `docs/site/src/components/ui/JsonEditor.tsx`

- [ ] **Step 1: Create CodeOutput.tsx**

Generates curl and SDK code strings from the current playground state.

```tsx
// docs/site/src/components/ui/CodeOutput.tsx
import { useState } from 'react';
import type { FormatKey } from '../engine/formats';

interface Config {
  format: FormatKey;
  title: string;
  description: string;
  author: string;
  tag: string;
  accent: string;
  font: string;
  titleSize: number;
  descSize: number;
  layout: string;
  gradient: string;
}

interface Props {
  config: Config;
  accent: string;
}

function buildCurl(config: Config): string {
  const body: Record<string, unknown> = { format: config.format, title: config.title };
  if (config.description) body.description = config.description;
  if (config.author) body.author = config.author;
  if (config.tag) body.tag = config.tag;
  const style: Record<string, unknown> = {};
  if (config.accent !== '#38ef7d') style.accent = config.accent;
  if (config.font !== 'Outfit') style.font = config.font;
  if (config.titleSize !== 48) style.titleSize = config.titleSize;
  if (config.descSize !== 22) style.descSize = config.descSize;
  if (config.layout !== 'left') style.layout = config.layout;
  if (Object.keys(style).length > 0) body.style = style;
  const json = JSON.stringify(body, null, 2);
  return `curl -X POST https://api.og-engine.com/render \\
  -H "Authorization: Bearer oge_sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${json}' \\
  --output image.png`;
}

function buildSDK(config: Config): string {
  const opts: string[] = [`  format: '${config.format}'`, `  title: '${config.title}'`];
  if (config.description) opts.push(`  description: '${config.description}'`);
  if (config.tag) opts.push(`  tag: '${config.tag}'`);
  const styleOpts: string[] = [];
  if (config.accent !== '#38ef7d') styleOpts.push(`    accent: '${config.accent}'`);
  if (config.font !== 'Outfit') styleOpts.push(`    font: '${config.font}'`);
  if (styleOpts.length > 0) opts.push(`  style: {\n${styleOpts.join(',\n')}\n  }`);
  return `import { OGEngine } from 'og-engine-sdk'

const og = new OGEngine(process.env.OG_ENGINE_API_KEY!)

const image = await og.render({
${opts.join(',\n')}
})`;
}

export function CodeOutput({ config, accent }: Props) {
  const [tab, setTab] = useState<'curl' | 'sdk'>('curl');
  const [copied, setCopied] = useState(false);
  const code = tab === 'curl' ? buildCurl(config) : buildSDK(config);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['curl', 'sdk'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: 9, color: tab === t ? accent : '#475569', background: 'none',
                border: 'none', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
                fontFamily: 'inherit', padding: 0,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          style={{
            fontSize: 9, color: copied ? accent : '#475569', background: 'none',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: 14, fontSize: 11, lineHeight: 1.6, color: '#94a3b8',
        overflowX: 'auto', background: '#0c0f1a', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
```

- [ ] **Step 2: Create JsonEditor.tsx**

```tsx
// docs/site/src/components/ui/JsonEditor.tsx
import { useState, useEffect } from 'react';

interface Props {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  accent: string;
}

export function JsonEditor({ value, onChange, accent }: Props) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      setError(null);
      onChange(parsed);
    } catch {
      setError('Invalid JSON');
    }
  };

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${error ? '#ef444466' : 'rgba(255,255,255,0.06)'}` }}>
      <div style={{ padding: '6px 12px', fontSize: 9, color: error ? '#ef4444' : '#475569', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', letterSpacing: 1 }}>
        {error ?? 'JSON'}
      </div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%', minHeight: 200, margin: 0, padding: 14, fontSize: 11,
          lineHeight: 1.6, color: '#94a3b8', background: '#0c0f1a', border: 'none',
          fontFamily: "'JetBrains Mono', monospace", resize: 'vertical', outline: 'none',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/components/ui/CodeOutput.tsx docs/site/src/components/ui/JsonEditor.tsx
git commit -m "feat(docs): add CodeOutput and JsonEditor UI components"
```

---

## Task 9: PlaygroundMini Component

**Files:**
- Create: `docs/site/src/components/PlaygroundMini.tsx`

- [ ] **Step 1: Create PlaygroundMini.tsx**

Compact version for the home page: title + description inputs, live Canvas preview, fixed to `og` format / `default` template.

```tsx
// docs/site/src/components/PlaygroundMini.tsx
import { useState, useEffect, useRef } from 'react';
import { renderCard } from './engine/canvas-renderer';
import { GRADIENTS } from './engine/gradients';
import { FONTS, loadGoogleFont } from './engine/fonts';
import { FORMATS } from './engine/formats';

export default function PlaygroundMini() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('Server-Side Text Layout Without a Browser');
  const [description, setDescription] = useState('Pure JavaScript text measurement replaces Puppeteer. Sub-millisecond layout for OG images.');
  const [renderTime, setRenderTime] = useState(0);
  const accent = '#38ef7d';
  const fontEntry = FONTS[0]; // Outfit

  useEffect(() => { loadGoogleFont(fontEntry); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      renderCard(canvas, {
        title, description, author: '', tag: '', format: 'og',
        accent, layout: 'left', titleSize: 48, descSize: 22,
        fontEntry, gradient: GRADIENTS[0], bgImage: null, overlayOpacity: 0.65,
      });
      setRenderTime(performance.now() - t0);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description]);

  const fmt = FORMATS.og;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a title..."
          style={{
            width: '100%', padding: '9px 11px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
            color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter a description..."
          style={{
            width: '100%', padding: '9px 11px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
            color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: '#475569', textAlign: 'center' }}>
        Rendered in <span style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>{renderTime.toFixed(1)}ms</span>
        {' \u00b7 '}
        <span style={{ color: '#fbbf24' }}>{Math.round(850 / Math.max(0.1, renderTime))}x faster</span> than Puppeteer
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/PlaygroundMini.tsx
git commit -m "feat(docs): add PlaygroundMini component for home page"
```

---

## Task 10: Full Playground Component

**Files:**
- Create: `docs/site/src/components/Playground.tsx`

- [ ] **Step 1: Create Playground.tsx**

The full-featured playground with all controls, live preview, code output, and download.

```tsx
// docs/site/src/components/Playground.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import { FORMATS, type FormatKey } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { CodeOutput } from './ui/CodeOutput';

export default function Playground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('Server-Side Text Layout Without a Browser');
  const [description, setDescription] = useState('Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content.');
  const [author, setAuthor] = useState('Pretext Engine');
  const [tag, setTag] = useState('Open Source');
  const [format, setFormat] = useState<FormatKey>('og');
  const [accent, setAccent] = useState('#38ef7d');
  const [layout, setLayout] = useState<'left' | 'center' | 'bottom'>('left');
  const [titleSize, setTitleSize] = useState(48);
  const [descSize, setDescSize] = useState(22);
  const [fontEntry, setFontEntry] = useState<FontEntry>(FONTS[0]);
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState<RenderResult | null>(null);

  useEffect(() => { loadGoogleFont(fontEntry); }, [fontEntry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const result = renderCard(canvas, {
        title, description, author, tag, format, accent, layout,
        titleSize, descSize, fontEntry, gradient, bgImage: null, overlayOpacity: 0.65,
      });
      setRenderTime(performance.now() - t0);
      setInfo(result);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description, author, tag, format, accent, layout, titleSize, descSize, fontEntry, gradient]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `og-${format}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }, [format]);

  const fmt = FORMATS[format];

  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', lineHeight: '1.5',
  };

  const labelStyle = {
    fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase' as const,
    display: 'block', marginBottom: 3,
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 600 }}>
      {/* Left: Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormatSelector value={format} onChange={setFormat} accent={accent} />

        <div>
          <label style={labelStyle}>Tag</label>
          <input value={tag} onChange={(e) => setTag(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Author</label>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} style={inputStyle} />
        </div>

        <AccentPicker value={accent} onChange={setAccent} />
        <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
        <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
        <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
        <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
        <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
      </div>

      {/* Right: Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
        </div>

        {/* Simulated response headers */}
        {info && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, marginBottom: 8 }}>RESPONSE HEADERS</div>
            {[
              ['X-Render-Time-Ms', renderTime.toFixed(2)],
              ['X-Title-Lines', String(info.titleVisibleLines)],
              ['X-Desc-Lines', String(info.descVisibleLines)],
              ['X-Layout-Overflow', String(info.overflow)],
              ['Content-Type', 'image/png'],
            ].map(([k, v], i) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
              }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--sl-font-mono)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={download} style={{
            flex: 1, padding: 12, borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
            fontWeight: 700, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
            color: '#06080c',
          }}>
            Download PNG
          </button>
        </div>

        <CodeOutput
          config={{ format, title, description, author, tag, accent, font: fontEntry.name, titleSize, descSize, layout, gradient: gradient.slug }}
          accent={accent}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/Playground.tsx
git commit -m "feat(docs): add full Playground component with all controls"
```

---

## Task 11: PlaygroundContextual Component

**Files:**
- Create: `docs/site/src/components/PlaygroundContextual.tsx`

- [ ] **Step 1: Create PlaygroundContextual.tsx**

A configurable playground that shows only the controls relevant to a specific guide page. Accepts props to control which panels are visible and pre-set values.

```tsx
// docs/site/src/components/PlaygroundContextual.tsx
import { useState, useEffect, useRef } from 'react';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import type { FormatKey } from './engine/formats';
import { FORMATS } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { TemplateSelector } from './ui/TemplateSelector';

interface Props {
  /** Which control panels to show */
  panels?: Array<'content' | 'format' | 'style' | 'template'>;
  /** Initial values */
  initialTitle?: string;
  initialDescription?: string;
  initialFormat?: FormatKey;
  initialAccent?: string;
}

export default function PlaygroundContextual({
  panels = ['content', 'format'],
  initialTitle = 'Hello, OG Engine',
  initialDescription = 'Generated in 2ms, no browser needed.',
  initialFormat = 'og',
  initialAccent = '#38ef7d',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [format, setFormat] = useState<FormatKey>(initialFormat);
  const [accent, setAccent] = useState(initialAccent);
  const [layout, setLayout] = useState<'left' | 'center' | 'bottom'>('left');
  const [titleSize, setTitleSize] = useState(48);
  const [descSize, setDescSize] = useState(22);
  const [fontEntry, setFontEntry] = useState<FontEntry>(FONTS[0]);
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [template, setTemplate] = useState('default');
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState<RenderResult | null>(null);

  useEffect(() => { loadGoogleFont(fontEntry); }, [fontEntry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const result = renderCard(canvas, {
        title, description, author: '', tag: '', format, accent, layout,
        titleSize, descSize, fontEntry, gradient, bgImage: null, overlayOpacity: 0.65,
      });
      setRenderTime(performance.now() - t0);
      setInfo(result);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description, format, accent, layout, titleSize, descSize, fontEntry, gradient, template]);

  const fmt = FORMATS[format];
  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 12 }}>
        Rendered in <span style={{ color: accent }}>{renderTime.toFixed(1)}ms</span>
        {info && <> &middot; Title: {info.titleVisibleLines}/{info.titleTotalLines} lines {info.overflow && <span style={{ color: '#fb7185' }}>(overflow)</span>}</>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {panels.includes('format') && <FormatSelector value={format} onChange={setFormat} accent={accent} />}
        {panels.includes('template') && <TemplateSelector value={template} onChange={setTemplate} accent={accent} />}
        {panels.includes('content') && (
          <>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={inputStyle} />
          </>
        )}
        {panels.includes('style') && (
          <>
            <AccentPicker value={accent} onChange={setAccent} />
            <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
            <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
            <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
            <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
            <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/PlaygroundContextual.tsx
git commit -m "feat(docs): add PlaygroundContextual for guide pages"
```

---

## Task 12: Home Page & Quick Start Content

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Create: `docs/site/src/content/docs/quick-start.mdx`

- [ ] **Step 1: Write the home page (index.mdx)**

Replace the placeholder with the full home page content from spec Section 4:

```mdx
---
title: OG Engine
description: Generate images in 2ms. No browser required.
template: splash
hero:
  tagline: Server-side image generation API. Send JSON, get back a PNG. Replaces Puppeteer at 500x the speed.
  actions:
    - text: Get Started Free
      link: /quick-start/
      icon: right-arrow
    - text: Try the Playground
      link: /playground/
      variant: minimal
---

import PlaygroundMini from '../../components/PlaygroundMini';

## Lightning Fast

| | Puppeteer | OG Engine |
|---|---|---|
| **Render time** | ~850ms | **~2ms** |
| **Memory per render** | ~200-500MB | **~10MB** |
| **Infrastructure** | Chrome binary, Xvfb, sandboxing | **Node.js process** |
| **Concurrency** | ~5-10 per instance | **500+ per instance** |
| **Cold start** | ~2-5s | **~50ms** |
| **Languages** | All (full browser) | **All (CJK, Arabic, emoji)** |

## Try It Live

Type a title and see the image update in real-time — no API key needed.

<PlaygroundMini client:visible />

## Quick Start

```bash
curl -X POST https://api.og-engine.com/render \
  -H "Authorization: Bearer oge_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"format": "og", "title": "Hello, OG Engine"}' \
  --output hello.png
```

## Supported Formats

| Format | Dimensions | Use Case |
|---|---|---|
| `og` | 1200x630 | Open Graph / Facebook |
| `twitter` | 1200x675 | Twitter / X cards |
| `square` | 1080x1080 | Instagram / general |
| `linkedin` | 1200x627 | LinkedIn posts |
| `story` | 1080x1920 | Instagram/TikTok stories |
```

- [ ] **Step 2: Write the Quick Start page (quick-start.mdx)**

```mdx
---
title: Quick Start
description: From zero to your first generated image in under 2 minutes.
---

import PlaygroundContextual from '../../components/PlaygroundContextual';

## Step 1 — Get Your API Key

Sign up with your email. No credit card required.

```bash
curl -X POST https://api.og-engine.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

```json
{ "apiKey": "oge_sk_a1b2c3...", "plan": "free", "limit": 500 }
```

Check your email — your API key is also in the response above.

## Step 2 — Generate Your First Image

```bash
curl -X POST https://api.og-engine.com/render \
  -H "Authorization: Bearer oge_sk_a1b2c3..." \
  -H "Content-Type: application/json" \
  -d '{"format": "og", "title": "Hello, OG Engine"}' \
  --output hello.png
```

## Step 3 — Customize It

```json
{
  "format": "og",
  "title": "My First OG Image",
  "description": "Generated in 2ms, no browser needed.",
  "tag": "Tutorial",
  "style": {
    "accent": "#38ef7d",
    "font": "Outfit",
    "layout": "left"
  }
}
```

Try editing the title below — the image updates instantly:

<PlaygroundContextual client:visible panels={['content']} initialTitle="My First OG Image" initialDescription="Generated in 2ms, no browser needed." />

## Step 4 — Check If Text Fits (Free, Unlimited)

```bash
curl -X POST https://api.og-engine.com/validate \
  -H "Content-Type: application/json" \
  -d '{"format": "og", "title": "Some very long headline that might not fit..."}'
```

```json
{
  "fits": true,
  "title": { "lines": 2, "maxLines": 3, "overflow": false },
  "computeTimeMs": 0.12
}
```

## Step 5 — Use the SDK (Optional)

```bash
npm install og-engine-sdk
```

```typescript
import { OGEngine } from 'og-engine-sdk'

const og = new OGEngine('oge_sk_a1b2c3...')

const image = await og.render({
  format: 'og',
  title: 'Hello from the SDK',
})

await Bun.write('hello.png', image)
```

## Next Steps

- Explore the [Templates Gallery](/templates/gallery/) to see all available designs
- Learn about [Formats & Templates](/guides/formats-and-templates/) for different platforms
- Dive into the [API Reference](/api-reference/overview/) for full endpoint details
```

- [ ] **Step 3: Verify the build**

Run: `cd docs/site && npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/content/docs/quick-start.mdx
git commit -m "feat(docs): add home page and quick start guide with playground"
```

---

## Task 13: Guide Pages (All 7)

**Files:**
- Create: `docs/site/src/content/docs/guides/generating-images.mdx`
- Create: `docs/site/src/content/docs/guides/formats-and-templates.mdx`
- Create: `docs/site/src/content/docs/guides/customizing-styles.mdx`
- Create: `docs/site/src/content/docs/guides/background-images.mdx`
- Create: `docs/site/src/content/docs/guides/text-validation.mdx`
- Create: `docs/site/src/content/docs/guides/batch-rendering.mdx`
- Create: `docs/site/src/content/docs/guides/error-handling.mdx`

Each guide follows the pattern from spec Section 7: what, why, how, example, playground. Write all 7 guides following the spec content outlines. Each guide should end with a "Next Steps" section linking to related pages.

Playground embeddings use `PlaygroundContextual` with the `panels` prop set to show only the controls relevant to that guide. For example:

- **generating-images.mdx**: `panels={['content']}` — basic title/description
- **formats-and-templates.mdx**: `panels={['content', 'format', 'template']}` — format + template selectors
- **customizing-styles.mdx**: `panels={['content', 'style']}` — all style controls
- **background-images.mdx**: `panels={['content']}` — content only (background image upload not available in client-side playground)
- **text-validation.mdx**: `panels={['content', 'format']}` — shows overflow detection
- **batch-rendering.mdx**: No playground (batch is a server feature)
- **error-handling.mdx**: No playground (error responses are server-side)

- [ ] **Step 1: Write all 7 guide files**

Each file starts with frontmatter (`title`, `description`), imports `PlaygroundContextual` where applicable, and ends with "Next Steps" links. Guides without a playground (batch-rendering, error-handling) are pure MDX prose with code examples.

Write each guide covering these specific items from spec Section 7:

**generating-images.mdx** — What happens when you call `/render` (text measurement -> layout -> canvas draw -> PNG encode). Minimal request (just `format` + `title`). Full request with all fields. Reading response headers (`X-Render-Time-Ms`, `X-Title-Lines`, `X-Layout-Overflow`). Output formats: PNG vs WebP (Starter+). Quality setting for WebP. Playground: `panels={['content']}`.

**formats-and-templates.mdx** — The 5 format presets with exact dimensions (og 1200x630, twitter 1200x675, square 1080x1080, linkedin 1200x627, story 1080x1920). How format affects max title/description lines. The 4 templates with descriptions (default, social-card, blog-hero, email-banner). Which format+template combos work best. Playground: `panels={['content', 'format', 'template']}`.

**customizing-styles.mdx** — `style.accent` (hex color). `style.font` (link to Fonts page). `style.titleSize`/`style.descSize` with min/max (28-72 / 14-32). `style.layout` — left, center, bottom. `style.gradient` — 6 presets with names. Defaults when fields are omitted. Playground: `panels={['content', 'style']}`.

**background-images.mdx** — Uploading via multipart form (curl + SDK examples). Compositing (cover crop + dark overlay). `style.overlayOpacity` (0.2-0.9). Accepted formats: JPEG, PNG, WebP. Size limit: 5MB. How `blog-hero` template is designed for backgrounds. Playground: `panels={['content']}` (note: file upload not available client-side).

**text-validation.mdx** — Why validate before rendering (save API calls). `/validate` is free, unlimited, not metered. Basic validation: does the text fit? Custom constraints: `maxTitleLines`, `maxDescLines`. Custom font/size. Using validation in a form (check on blur). Playground: `panels={['content', 'format']}`.

**batch-rendering.mdx** — When to use batch. Request structure: array of items. Response: ZIP with numbered images. Partial failures: `errors.json` inside ZIP. Plan restriction: Pro and Scale only. Performance: N images in ~Nx3ms. curl and SDK examples. No playground.

**error-handling.mdx** — Error structure: `{ error, message, details }`. Full error code table from spec Section 9 (11 error codes). Rate limiting headers. What to do when rate limited. Retry strategy for 5xx. No playground.

- [ ] **Step 2: Verify the build**

Run: `cd docs/site && npm run build`

Expected: Build succeeds with all 7 guide pages rendered.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/guides/
git commit -m "feat(docs): add all 7 guide pages with playground embeds"
```

---

## Task 14: API Reference Pages (All 6)

**Files:**
- Create: `docs/site/src/content/docs/api-reference/overview.mdx`
- Create: `docs/site/src/content/docs/api-reference/render.mdx`
- Create: `docs/site/src/content/docs/api-reference/validate.mdx`
- Create: `docs/site/src/content/docs/api-reference/batch.mdx`
- Create: `docs/site/src/content/docs/api-reference/health.mdx`
- Create: `docs/site/src/content/docs/api-reference/errors.mdx`

Each endpoint page follows the identical structure from spec Section 8. The content is already fully defined in the spec — transfer it verbatim into MDX format with proper tables, code blocks, and frontmatter.

The `render.mdx` page should embed a `PlaygroundContextual` with `panels={['content', 'format', 'style']}` for the interactive demo.

- [ ] **Step 1: Write all 6 API reference files**

Transfer the full tables, schemas, examples, and error codes from spec Sections 8 and 9 into MDX format.

- [ ] **Step 2: Verify the build**

Run: `cd docs/site && npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/api-reference/
git commit -m "feat(docs): add all 6 API reference pages"
```

---

## Task 15: SDK, Templates, Fonts, Self-Hosting, Pricing, Changelog

**Files:**
- Create: `docs/site/src/content/docs/sdk/installation.mdx`
- Create: `docs/site/src/content/docs/sdk/reference.mdx`
- Create: `docs/site/src/content/docs/templates/gallery.mdx`
- Create: `docs/site/src/content/docs/fonts/available-fonts.mdx`
- Create: `docs/site/src/content/docs/self-hosting/docker.mdx`
- Create: `docs/site/src/content/docs/pricing.mdx`
- Create: `docs/site/src/content/docs/changelog.mdx`

All content is defined in spec Sections 10-15. Transfer to MDX format.

- **SDK pages**: Installation commands, client init, all 4 methods with TypeScript signatures, framework integration snippets (Next.js, Astro, Express, Cloudflare Worker).
- **Templates gallery**: Import `PlaygroundContextual` with `panels={['format', 'template']}` for interactive preview.
- **Fonts page**: Table of 8 fonts with API names, script support, weights. Import `PlaygroundContextual` with `panels={['content', 'style']}` so visitors can preview fonts.
- **Self-hosting**: Docker run, Docker Compose, Fly.io, Railway deployment instructions.
- **Pricing**: Plan comparison table, rate limiting explanation, FAQ.
- **Changelog**: Initial v0.1.0 entry.

- [ ] **Step 1: Write all 7 content files**

- [ ] **Step 2: Verify the build**

Run: `cd docs/site && npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/sdk/ docs/site/src/content/docs/templates/ docs/site/src/content/docs/fonts/ docs/site/src/content/docs/self-hosting/ docs/site/src/content/docs/pricing.mdx docs/site/src/content/docs/changelog.mdx
git commit -m "feat(docs): add SDK, templates, fonts, self-hosting, pricing, changelog pages"
```

---

## Task 16: Playground Page

**Files:**
- Create: `docs/site/src/content/docs/playground.mdx`

- [ ] **Step 1: Write the playground page**

```mdx
---
title: Playground
description: Build and preview OG images in real-time. No API key required.
---

import Playground from '../../components/Playground';

Experiment with all available formats, templates, styles, and fonts. Everything renders instantly in your browser using the same Canvas engine that powers the API.

<Playground client:visible />

:::tip[Ready to integrate?]
When you're happy with your design, copy the curl command or SDK code from below the preview and use it in your project. [Get your free API key](/quick-start/) to start generating images via the API.
:::
```

- [ ] **Step 2: Verify the build**

Run: `cd docs/site && npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/playground.mdx
git commit -m "feat(docs): add standalone playground page"
```

---

## Task 17: OpenAPI 3.1 Spec

**Files:**
- Create: `docs/site/public/openapi.json`

- [ ] **Step 1: Write the complete OpenAPI spec**

Write the full `openapi.json` following spec Section 19. Include all 4 endpoints with complete request/response schemas, security scheme, server URLs, and example values. Every field from the API reference tables in spec Section 8 must be represented in the JSON Schema with `type`, `description`, `default`, `enum`, `minimum`, `maximum`, and `example` where applicable.

The file should be valid OpenAPI 3.1.0 JSON that can be imported directly into Swagger UI or Postman.

Key schemas to define in `components.schemas`:
- `RenderRequest` (with nested `RenderStyle` and `RenderOutput`)
- `ValidateRequest`
- `ValidateResponse`
- `BatchRequest`
- `HealthResponse`
- `ErrorResponse`

- [ ] **Step 2: Validate the spec**

Run: `cd docs/site && npx @redocly/cli lint public/openapi.json`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add docs/site/public/openapi.json
git commit -m "feat(docs): add OpenAPI 3.1 spec for all API endpoints"
```

---

## Task 18: Final Build Verification & Dev Server Check

- [ ] **Step 1: Clean build**

Run: `cd docs/site && rm -rf dist && npm run build`

Expected: Build succeeds with no errors. All pages rendered.

- [ ] **Step 2: Count output pages**

Run: `find docs/site/dist -name "index.html" | wc -l`

Expected: 22+ HTML files (home, quick-start, 7 guides, 6 API reference, 2 SDK, templates gallery, fonts, docker, playground, pricing, changelog).

- [ ] **Step 3: Start dev server and verify**

Run: `cd docs/site && npm run dev`

Manually verify in the browser:
- Home page loads with hero, comparison table, and PlaygroundMini
- Quick Start has embedded playground
- All sidebar links work
- Full Playground page renders with all controls
- Fonts load when selected in the playground
- Code output generates valid curl/SDK snippets
- Download PNG works from the playground
- Custom dark theme is applied (dark background, green accent, no light mode toggle)

- [ ] **Step 4: Final commit**

```bash
git add -A docs/site/
git commit -m "feat(docs): complete documentation site — all pages, playground, OpenAPI spec"
```

---

## Summary

| Task | Description | Files |
|---|---|---|
| 1 | Scaffold Starlight project | 3 config files |
| 2 | Dark theme & logo | 2 files |
| 3 | Formats & gradients data | 2 engine modules |
| 4 | Text measurement | 1 engine module |
| 5 | Font loading | 1 engine module |
| 6 | Canvas renderer | 1 engine module (core) |
| 7 | UI controls (3 components) | 3 React components |
| 8 | CodeOutput & JsonEditor | 2 React components |
| 9 | PlaygroundMini | 1 React component |
| 10 | Full Playground | 1 React component |
| 11 | PlaygroundContextual | 1 React component |
| 12 | Home page & Quick Start | 2 MDX pages |
| 13 | 7 Guide pages | 7 MDX pages |
| 14 | 6 API Reference pages | 6 MDX pages |
| 15 | SDK, Templates, Fonts, etc. | 7 MDX pages |
| 16 | Playground page | 1 MDX page |
| 17 | OpenAPI spec | 1 JSON file |
| 18 | Final verification | Build + dev server check |

**Total: 18 tasks, ~40 files, ~15 commits.**
