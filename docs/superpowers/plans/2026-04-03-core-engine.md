# Core Engine & Playground API Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-side rendering engine (Hono + @napi-rs/canvas) that matches the documented API, then wire the playground to call it.

**Architecture:** Port the existing client-side Canvas renderer to server-side @napi-rs/canvas. Use Canvas measureText for text measurement initially (matching current client-side behavior), with Pretext integration as a follow-up enhancement. Hono serves the HTTP endpoints documented in the docs site. The playground gets an optional mode to call the real API instead of client-side rendering.

**Tech Stack:** Bun, Hono, @napi-rs/canvas, Zod, Vitest

**Source of truth:** The docs site (`docs/site/src/content/docs/`) defines the API contract. Implementation must match the documented behavior exactly.

---

## File Structure

```
og-engine/
├── package.json                    # API server package
├── tsconfig.json                   # TypeScript config
├── src/
│   ├── index.ts                    # Hono server entry point
│   ├── engine/
│   │   ├── formats.ts              # Format definitions (port from client)
│   │   ├── gradients.ts            # Gradient definitions (port from client)
│   │   ├── fonts.ts                # Font registration with @napi-rs/canvas
│   │   ├── text-measure.ts         # Text measurement with @napi-rs/canvas
│   │   └── renderer.ts             # Canvas rendering (port from client)
│   ├── api/
│   │   ├── health.ts               # GET /health
│   │   ├── validate.ts             # POST /validate
│   │   └── render.ts               # POST /render
│   └── schemas/
│       └── request.ts              # Zod schemas for API validation
├── tests/
│   ├── engine/
│   │   ├── formats.test.ts         # Format definitions tests
│   │   ├── text-measure.test.ts    # Text measurement tests
│   │   └── renderer.test.ts        # Renderer output tests
│   ├── api/
│   │   ├── health.test.ts          # Health endpoint tests
│   │   ├── validate.test.ts        # Validate endpoint tests
│   │   └── render.test.ts          # Render endpoint tests
│   └── benchmark.ts                # Performance benchmark
├── scripts/
│   └── download-fonts.ts           # Fetch Google Fonts as TTF
└── fonts/                          # Downloaded TTF files (gitignored)
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize the project**

Run from the repo root `/Users/phmatray/Repositories/javascript/og-engine`:

```bash
bun init -y
```

- [ ] **Step 2: Replace package.json with the correct content**

```json
{
  "name": "og-engine",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "bench": "bun run tests/benchmark.ts",
    "fonts:download": "bun run scripts/download-fonts.ts"
  },
  "dependencies": {
    "@napi-rs/canvas": "^0.1.65",
    "hono": "^4.7.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "vitest": "^3.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts"]
}
```

- [ ] **Step 4: Update .gitignore**

Append to the existing `.gitignore` (or create if missing):

```gitignore
# Dependencies
node_modules/

# Build
dist/

# Fonts (downloaded at build time)
fonts/*.ttf
fonts/**/*.ttf

# Environment
.env
.env.local
```

- [ ] **Step 5: Install dependencies**

```bash
bun install
```

- [ ] **Step 6: Create fonts directory**

```bash
mkdir -p fonts
```

- [ ] **Step 7: Verify setup**

```bash
bun --version
ls node_modules/@napi-rs/canvas
ls node_modules/hono
```

Expected: All directories exist, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json .gitignore
git commit -m "chore: initialize API server with Bun, Hono, @napi-rs/canvas"
```

---

## Task 2: Font Download Script

**Files:**
- Create: `scripts/download-fonts.ts`

This script downloads Google Fonts as TTF files into `fonts/`. The font list matches `docs/site/src/components/engine/fonts.ts`.

- [ ] **Step 1: Write the download script**

```typescript
// scripts/download-fonts.ts
import { mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';

const FONTS_DIR = join(import.meta.dir, '..', 'fonts');

// Must match the 8 fonts from the docs site engine
const FONT_SPECS = [
  { name: 'Outfit', weights: [400, 700, 800] },
  { name: 'Inter', weights: [400, 700, 800] },
  { name: 'Playfair Display', weights: [400, 700, 800] },
  { name: 'Sora', weights: [400, 700, 800] },
  { name: 'Space Grotesk', weights: [400, 700] },
  { name: 'JetBrains Mono', weights: [400, 700] },
  { name: 'Noto Sans JP', weights: [400, 700] },
  { name: 'Noto Sans Arabic', weights: [400, 700] },
] as const;

const WEIGHT_NAMES: Record<number, string> = {
  400: 'Regular',
  700: 'Bold',
  800: 'ExtraBold',
};

async function downloadFont(family: string, weight: number): Promise<void> {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const dir = join(FONTS_DIR, slug);
  await mkdir(dir, { recursive: true });

  const weightName = WEIGHT_NAMES[weight] ?? String(weight);
  const filename = `${slug}-${weightName.toLowerCase()}.ttf`;
  const filepath = join(dir, filename);

  // Skip if already downloaded
  try {
    await stat(filepath);
    console.log(`  ✓ ${family} ${weightName} (cached)`);
    return;
  } catch {
    // File doesn't exist, download it
  }

  // Google Fonts CSS API with TTF user-agent
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(cssUrl, {
    headers: {
      // Request TTF format by using an older user-agent
      'User-Agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)',
    },
  });

  if (!cssRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: CSS fetch failed (${cssRes.status})`);
    return;
  }

  const css = await cssRes.text();
  const urlMatch = css.match(/url\(([^)]+\.ttf)\)/);
  if (!urlMatch) {
    console.error(`  ✗ ${family} ${weightName}: No TTF URL found in CSS`);
    console.error(`    CSS snippet: ${css.slice(0, 200)}`);
    return;
  }

  const ttfUrl = urlMatch[1];
  const ttfRes = await fetch(ttfUrl);
  if (!ttfRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: TTF download failed (${ttfRes.status})`);
    return;
  }

  const buffer = await ttfRes.arrayBuffer();
  await writeFile(filepath, Buffer.from(buffer));
  console.log(`  ↓ ${family} ${weightName} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
}

async function main() {
  console.log('Downloading fonts to', FONTS_DIR);
  console.log('');

  for (const spec of FONT_SPECS) {
    console.log(spec.name);
    for (const weight of spec.weights) {
      await downloadFont(spec.name, weight);
    }
    console.log('');
  }

  console.log('Done.');
}

main().catch(console.error);
```

- [ ] **Step 2: Run the script**

```bash
bun run scripts/download-fonts.ts
```

Expected: TTF files downloaded into `fonts/<slug>/` directories. Should see output like:
```
Downloading fonts to /Users/phmatray/Repositories/javascript/og-engine/fonts

Outfit
  ↓ Outfit Regular (45 KB)
  ↓ Outfit Bold (46 KB)
  ↓ Outfit ExtraBold (46 KB)
...
```

- [ ] **Step 3: Verify fonts exist**

```bash
find fonts -name "*.ttf" | sort
```

Expected: At least 18 TTF files across 8 font directories.

- [ ] **Step 4: Commit**

```bash
git add scripts/download-fonts.ts
git commit -m "feat: add font download script for 8 Google Font families"
```

---

## Task 3: Engine — Format & Gradient Definitions

**Files:**
- Create: `src/engine/formats.ts`
- Create: `src/engine/gradients.ts`
- Create: `tests/engine/formats.test.ts`

These are direct ports from the client-side code with no DOM dependencies.

- [ ] **Step 1: Write the failing test for formats**

```typescript
// tests/engine/formats.test.ts
import { describe, it, expect } from 'vitest';
import { FORMATS, FORMAT_KEYS, type FormatKey } from '../src/engine/formats';

describe('FORMATS', () => {
  it('defines exactly 5 formats', () => {
    expect(FORMAT_KEYS).toHaveLength(5);
  });

  it('includes og, twitter, square, linkedin, story', () => {
    expect(FORMAT_KEYS).toContain('og');
    expect(FORMAT_KEYS).toContain('twitter');
    expect(FORMAT_KEYS).toContain('square');
    expect(FORMAT_KEYS).toContain('linkedin');
    expect(FORMAT_KEYS).toContain('story');
  });

  it('og format is 1200x630 with 3 title / 4 desc max lines', () => {
    const og = FORMATS['og'];
    expect(og.w).toBe(1200);
    expect(og.h).toBe(630);
    expect(og.maxTitleLines).toBe(3);
    expect(og.maxDescLines).toBe(4);
  });

  it('story format is 1080x1920 with 5 title / 6 desc max lines', () => {
    const story = FORMATS['story'];
    expect(story.w).toBe(1080);
    expect(story.h).toBe(1920);
    expect(story.maxTitleLines).toBe(5);
    expect(story.maxDescLines).toBe(6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun run test -- tests/engine/formats.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create formats.ts**

```typescript
// src/engine/formats.ts
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

- [ ] **Step 4: Create gradients.ts**

```typescript
// src/engine/gradients.ts
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

export function getGradientBySlug(slug: string): Gradient {
  return GRADIENTS.find((g) => g.slug === slug) ?? GRADIENTS[0];
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun run test -- tests/engine/formats.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/formats.ts src/engine/gradients.ts tests/engine/formats.test.ts
git commit -m "feat(engine): add format and gradient definitions"
```

---

## Task 4: Engine — Font Registration

**Files:**
- Create: `src/engine/fonts.ts`

This module registers downloaded TTF files with `@napi-rs/canvas` GlobalFonts and provides a lookup.

- [ ] **Step 1: Create fonts.ts**

```typescript
// src/engine/fonts.ts
import { GlobalFonts } from '@napi-rs/canvas';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export interface FontEntry {
  name: string;
  family: string;
  weights: number[];
  scripts: string[];
}

export const FONTS: FontEntry[] = [
  { name: 'Outfit', family: 'Outfit', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Inter', family: 'Inter', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Playfair Display', family: 'Playfair Display', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Sora', family: 'Sora', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Space Grotesk', family: 'Space Grotesk', weights: [400, 700], scripts: ['Latin'] },
  { name: 'JetBrains Mono', family: 'JetBrains Mono', weights: [400, 700], scripts: ['Latin'] },
  { name: 'Noto Sans JP', family: 'Noto Sans JP', weights: [400, 700], scripts: ['Latin', 'CJK'] },
  { name: 'Noto Sans AR', family: 'Noto Sans Arabic', weights: [400, 700], scripts: ['Latin', 'Arabic'] },
];

const FONT_NAMES = FONTS.map((f) => f.name);

let registered = false;

export async function registerFonts(fontsDir: string): Promise<string[]> {
  if (registered) return FONT_NAMES;

  const loaded: string[] = [];

  for (const entry of FONTS) {
    const slug = entry.name.toLowerCase().replace(/\s+/g, '-');
    const dir = join(fontsDir, slug);

    try {
      await stat(dir);
    } catch {
      console.warn(`Font directory missing: ${dir} — skipping ${entry.name}`);
      continue;
    }

    const files = await readdir(dir);
    const ttfFiles = files.filter((f) => f.endsWith('.ttf'));

    for (const file of ttfFiles) {
      const filepath = join(dir, file);
      GlobalFonts.registerFromPath(filepath, entry.family);
    }

    if (ttfFiles.length > 0) {
      loaded.push(entry.name);
    }
  }

  registered = true;
  console.log(`Registered ${loaded.length} font families: ${loaded.join(', ')}`);
  return loaded;
}

export function getFontByName(name: string): FontEntry {
  return FONTS.find((f) => f.name === name) ?? FONTS[0];
}

export function isValidFont(name: string): boolean {
  return FONTS.some((f) => f.name === name);
}
```

- [ ] **Step 2: Verify font registration works**

```bash
bun -e "
import { registerFonts } from './src/engine/fonts.ts';
const loaded = await registerFonts('./fonts');
console.log('Loaded:', loaded);
"
```

Expected: Lists the font families that were registered (depends on Task 2 having run).

- [ ] **Step 3: Commit**

```bash
git add src/engine/fonts.ts
git commit -m "feat(engine): add font registration with @napi-rs/canvas"
```

---

## Task 5: Engine — Text Measurement

**Files:**
- Create: `src/engine/text-measure.ts`
- Create: `tests/engine/text-measure.test.ts`

Port of the client-side text-measure.ts, using @napi-rs/canvas instead of DOM Canvas.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/engine/text-measure.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { measureLines, measureTextWidth } from '../src/engine/text-measure';
import { registerFonts } from '../src/engine/fonts';
import { join } from 'path';

beforeAll(async () => {
  await registerFonts(join(import.meta.dir, '..', 'fonts'));
});

describe('measureLines', () => {
  it('returns empty array for empty text', () => {
    expect(measureLines('', '400 48px Outfit', 800)).toEqual([]);
  });

  it('returns single line for short text', () => {
    const lines = measureLines('Hello', '400 48px Outfit', 800);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello');
    expect(lines[0].width).toBeGreaterThan(0);
  });

  it('wraps long text into multiple lines', () => {
    const longText = 'This is a much longer title that should definitely wrap onto multiple lines when rendered';
    const lines = measureLines(longText, '800 48px Outfit', 600);
    expect(lines.length).toBeGreaterThan(1);
    // All original words should be present across all lines
    const reconstructed = lines.map((l) => l.text).join(' ');
    expect(reconstructed).toBe(longText);
  });

  it('handles explicit newlines', () => {
    const lines = measureLines('Line one\nLine two', '400 48px Outfit', 800);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0].text).toBe('Line one');
    expect(lines[1].text).toBe('Line two');
  });
});

describe('measureTextWidth', () => {
  it('returns a positive number for non-empty text', () => {
    const w = measureTextWidth('Hello', '400 48px Outfit');
    expect(w).toBeGreaterThan(0);
  });

  it('returns 0 for empty text', () => {
    const w = measureTextWidth('', '400 48px Outfit');
    expect(w).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun run test -- tests/engine/text-measure.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create text-measure.ts**

```typescript
// src/engine/text-measure.ts
import { createCanvas } from '@napi-rs/canvas';

export interface MeasuredLine {
  text: string;
  width: number;
}

// Shared off-screen canvas for measurement (1x1 is enough)
const measureCanvas = createCanvas(1, 1);
const measureCtx = measureCanvas.getContext('2d');

export function measureLines(text: string, font: string, maxWidth: number): MeasuredLine[] {
  if (!text || maxWidth <= 0) return [];

  measureCtx.font = font;
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
      const ww = measureCtx.measureText(word).width;
      const sp = cur ? measureCtx.measureText(' ').width : 0;

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

export function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun run test -- tests/engine/text-measure.test.ts
```

Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/text-measure.ts tests/engine/text-measure.test.ts
git commit -m "feat(engine): add server-side text measurement with @napi-rs/canvas"
```

---

## Task 6: Engine — Canvas Renderer

**Files:**
- Create: `src/engine/renderer.ts`
- Create: `tests/engine/renderer.test.ts`

Port of `docs/site/src/components/engine/canvas-renderer.ts`. Replaces `HTMLCanvasElement` with `@napi-rs/canvas` `Canvas`. Replaces `HTMLImageElement` with `@napi-rs/canvas` `Image`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/engine/renderer.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { renderCard, type RenderOptions } from '../src/engine/renderer';
import { registerFonts } from '../src/engine/fonts';
import { GRADIENTS } from '../src/engine/gradients';
import { join } from 'path';

beforeAll(async () => {
  await registerFonts(join(import.meta.dir, '..', 'fonts'));
});

function defaultOptions(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return {
    title: 'Hello, OG Engine',
    description: 'Generated in 2ms, no browser needed.',
    author: 'Test Author',
    tag: 'Test',
    format: 'og',
    accent: '#38ef7d',
    layout: 'left',
    titleSize: 48,
    descSize: 22,
    fontName: 'Outfit',
    gradient: 'void',
    bgImageBuffer: null,
    overlayOpacity: 0.65,
    ...overrides,
  };
}

describe('renderCard', () => {
  it('returns a PNG buffer for default OG format', () => {
    const result = renderCard(defaultOptions());
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    // PNG magic bytes: 0x89 P N G
    expect(result.buffer[0]).toBe(0x89);
    expect(result.buffer[1]).toBe(0x50); // P
    expect(result.buffer[2]).toBe(0x4e); // N
    expect(result.buffer[3]).toBe(0x47); // G
  });

  it('returns render metadata', () => {
    const result = renderCard(defaultOptions());
    expect(result.titleTotalLines).toBeGreaterThan(0);
    expect(result.titleVisibleLines).toBeGreaterThan(0);
    expect(typeof result.overflow).toBe('boolean');
  });

  it('produces correct dimensions (1200x630 for OG)', () => {
    const result = renderCard(defaultOptions());
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
  });

  it('renders all 5 formats without error', () => {
    for (const format of ['og', 'twitter', 'square', 'linkedin', 'story'] as const) {
      const result = renderCard(defaultOptions({ format }));
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  });

  it('renders all 3 layouts without error', () => {
    for (const layout of ['left', 'center', 'bottom'] as const) {
      const result = renderCard(defaultOptions({ layout }));
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  });

  it('detects overflow for very long title', () => {
    const result = renderCard(defaultOptions({
      title: 'This is an extremely long title that will certainly overflow the maximum number of lines allowed for the OG format which only permits three lines of title text',
    }));
    expect(result.overflow).toBe(true);
    expect(result.titleTotalLines).toBeGreaterThan(result.titleVisibleLines);
  });

  it('handles missing optional fields', () => {
    const result = renderCard(defaultOptions({
      description: '',
      author: '',
      tag: '',
    }));
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun run test -- tests/engine/renderer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create renderer.ts**

```typescript
// src/engine/renderer.ts
import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas';
import { measureLines, measureTextWidth } from './text-measure';
import { FORMATS, type FormatKey } from './formats';
import { getGradientBySlug } from './gradients';
import { getFontByName } from './fonts';

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
  fontName: string;
  gradient: string;
  bgImageBuffer: Buffer | null;
  overlayOpacity: number;
}

export interface RenderResult {
  buffer: Buffer;
  width: number;
  height: number;
  titleTotalLines: number;
  titleVisibleLines: number;
  descTotalLines: number;
  descVisibleLines: number;
  overflow: boolean;
}

export function renderCard(options: RenderOptions): RenderResult {
  const {
    title, description, author, tag, format, accent, layout,
    titleSize, descSize, fontName, gradient: gradientSlug,
    bgImageBuffer, overlayOpacity,
  } = options;

  const fmt = FORMATS[format];
  if (!fmt) throw new Error(`Unknown format: ${format}`);

  const W = fmt.w;
  const H = fmt.h;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const s = Math.max(W, H) / 1200;
  const fontEntry = getFontByName(fontName);
  const ff = fontEntry.family;

  // Background: gradient (bgImage support added in a later task)
  const grad = getGradientBySlug(gradientSlug);
  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, grad.stops[0]);
  bg.addColorStop(1, grad.stops[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = accent + '05';
  ctx.lineWidth = 1;
  const gs = 50 * s;
  for (let x = 0; x < W; x += gs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
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

  let yPos = isBottom ? H - px - totalH : isCenter ? (H - totalH) / 2 : Math.round(px * 1.2);
  const align: CanvasTextAlign = isCenter ? 'center' : 'left';
  const xP = isCenter ? W / 2 : px;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  // Accent bar
  if (!isCenter && !bgImageBuffer) {
    ctx.fillStyle = accent;
    ctx.fillRect(px, yPos, 4 * s, Math.min(visibleT.length * tLH + tagH, 80 * s));
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
    ctx.roundRect(pX, yPos, pW, pH, pH / 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = tagFont;
    ctx.textAlign = 'center';
    ctx.fillText(tagText, pX + pW / 2, yPos + pH / 2 - 7 * s);
    ctx.textAlign = align;
    yPos += tagH;
  }

  // Title lines
  ctx.fillStyle = '#f1f5f9';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '\u2026';
    ctx.fillText(t, xP, yPos);
    yPos += tLH;
  }
  yPos += g3v;

  // Description lines
  ctx.fillStyle = bgImageBuffer ? '#d1d5db' : '#94a3b8';
  ctx.font = dFont;
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > maxD) t += '\u2026';
    ctx.fillText(t, xP, yPos);
    yPos += dLH;
  }
  yPos += g4v;

  // Author
  ctx.fillStyle = accent;
  ctx.font = aFont;
  ctx.fillText(author || '', xP, yPos);

  // Badge
  ctx.fillStyle = accent + '33';
  ctx.font = `500 ${Math.round(12 * s)}px monospace`;
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
    buffer: canvas.toBuffer('image/png'),
    width: W,
    height: H,
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun run test -- tests/engine/renderer.test.ts
```

Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/renderer.ts tests/engine/renderer.test.ts
git commit -m "feat(engine): add server-side Canvas renderer with PNG output"
```

---

## Task 7: Zod Request Schemas

**Files:**
- Create: `src/schemas/request.ts`

Schemas for API request validation, matching the documented API contract.

- [ ] **Step 1: Create request schemas**

```typescript
// src/schemas/request.ts
import { z } from 'zod';
import { FORMAT_KEYS } from '../engine/formats';
import { FONTS } from '../engine/fonts';
import { GRADIENTS } from '../engine/gradients';

const formatEnum = z.enum(FORMAT_KEYS as [string, ...string[]]);
const layoutEnum = z.enum(['left', 'center', 'bottom']);
const fontNames = FONTS.map((f) => f.name);
const gradientSlugs = GRADIENTS.map((g) => g.slug);

export const renderSchema = z.object({
  format: formatEnum,
  template: z.string().default('default'),
  title: z.string().min(1, "The 'title' field is required."),
  description: z.string().default(''),
  author: z.string().default(''),
  tag: z.string().default(''),
  style: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Accent must be a 6-digit hex color (e.g. "#38ef7d").').default('#38ef7d'),
    layout: layoutEnum.default('left'),
    font: z.string().refine((v) => fontNames.includes(v), {
      message: `Font must be one of: ${fontNames.join(', ')}`,
    }).default('Outfit'),
    titleSize: z.number().int().min(28).max(72).default(48),
    descSize: z.number().int().min(14).max(32).default(22),
    gradient: z.string().refine((v) => gradientSlugs.includes(v), {
      message: `Gradient must be one of: ${gradientSlugs.join(', ')}`,
    }).default('void'),
    overlayOpacity: z.number().min(0.2).max(0.9).default(0.65),
  }).default({}),
  output: z.object({
    format: z.enum(['png']).default('png'),
    quality: z.number().int().min(1).max(100).default(90),
  }).default({}),
});

export const validateSchema = z.object({
  format: formatEnum,
  title: z.string().min(1, "The 'title' field is required."),
  description: z.string().default(''),
  font: z.string().refine((v) => fontNames.includes(v), {
    message: `Font must be one of: ${fontNames.join(', ')}`,
  }).default('Outfit'),
  titleSize: z.number().int().min(28).max(72).default(48),
  descSize: z.number().int().min(14).max(32).default(22),
  maxTitleLines: z.number().int().min(1).max(10).optional(),
  maxDescLines: z.number().int().min(1).max(10).optional(),
});

export type RenderRequest = z.infer<typeof renderSchema>;
export type ValidateRequest = z.infer<typeof validateSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/schemas/request.ts
git commit -m "feat(api): add Zod request validation schemas"
```

---

## Task 8: API — Health Endpoint

**Files:**
- Create: `src/api/health.ts`
- Create: `tests/api/health.test.ts`

Matches the documented `GET /health` response shape from `docs/site/src/content/docs/api-reference/health.mdx`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/health.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { healthRoute } from '../src/api/health';
import { registerFonts } from '../src/engine/fonts';
import { join } from 'path';

const app = new Hono();
app.route('/', healthRoute);

beforeAll(async () => {
  await registerFonts(join(import.meta.dir, '..', 'fonts'));
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('returns fonts, formats, templates, and version', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.fonts).toBeInstanceOf(Array);
    expect(body.fonts.length).toBeGreaterThan(0);
    expect(body.formats).toEqual(['og', 'twitter', 'square', 'linkedin', 'story']);
    expect(body.templates).toEqual(['default', 'social-card', 'blog-hero', 'email-banner']);
    expect(body.version).toBe('0.1.0');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun run test -- tests/api/health.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create health.ts**

```typescript
// src/api/health.ts
import { Hono } from 'hono';
import { FONTS } from '../engine/fonts';
import { FORMAT_KEYS } from '../engine/formats';

export const healthRoute = new Hono();

const TEMPLATES = ['default', 'social-card', 'blog-hero', 'email-banner'];

healthRoute.get('/health', (c) => {
  return c.json({
    status: 'ok',
    fonts: FONTS.map((f) => f.name),
    formats: FORMAT_KEYS,
    templates: TEMPLATES,
    version: '0.1.0',
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun run test -- tests/api/health.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/health.ts tests/api/health.test.ts
git commit -m "feat(api): add GET /health endpoint"
```

---

## Task 9: API — Validate Endpoint

**Files:**
- Create: `src/api/validate.ts`
- Create: `tests/api/validate.test.ts`

Matches `POST /validate` from `docs/site/src/content/docs/api-reference/validate.mdx`. Free, unlimited, optional auth, never metered.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/validate.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { validateRoute } from '../src/api/validate';
import { registerFonts } from '../src/engine/fonts';
import { join } from 'path';

const app = new Hono();
app.route('/', validateRoute);

beforeAll(async () => {
  await registerFonts(join(import.meta.dir, '..', 'fonts'));
});

function post(body: unknown) {
  return app.request('/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /validate', () => {
  it('returns fits: true for short text', async () => {
    const res = await post({ format: 'og', title: 'Hello' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fits).toBe(true);
    expect(body.title.lines).toBe(1);
    expect(body.title.overflow).toBe(false);
    expect(body.computeTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns fits: false for overflowing title', async () => {
    const res = await post({
      format: 'og',
      title: 'This is an extremely long title that will certainly overflow because it has too many words to possibly fit within three lines of the OG format at the default font size of forty-eight pixels',
    });
    const body = await res.json();
    expect(body.fits).toBe(false);
    expect(body.title.overflow).toBe(true);
    expect(body.title.lines).toBeGreaterThan(3);
  });

  it('returns 400 for missing format', async () => {
    const res = await post({ title: 'Hello' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_request');
  });

  it('returns 400 for missing title', async () => {
    const res = await post({ format: 'og' });
    expect(res.status).toBe(400);
  });

  it('accepts custom maxTitleLines', async () => {
    const res = await post({
      format: 'og',
      title: 'Short title',
      maxTitleLines: 1,
    });
    const body = await res.json();
    expect(body.title.maxLines).toBe(1);
  });

  it('includes description validation when provided', async () => {
    const res = await post({
      format: 'og',
      title: 'Title',
      description: 'Some description text',
    });
    const body = await res.json();
    expect(body.description).toBeDefined();
    expect(body.description.lines).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun run test -- tests/api/validate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create validate.ts**

```typescript
// src/api/validate.ts
import { Hono } from 'hono';
import { validateSchema } from '../schemas/request';
import { measureLines } from '../engine/text-measure';
import { getFontByName } from '../engine/fonts';
import { FORMATS } from '../engine/formats';

export const validateRoute = new Hono();

validateRoute.post('/validate', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json({
      error: 'invalid_request',
      message: 'Request body must be valid JSON.',
      docs: 'https://og-engine.com/api-reference/errors#invalid_request',
    }, 400);
  }

  const parsed = validateSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return c.json({
      error: 'invalid_request',
      message: issues[0]?.message ?? 'Validation failed.',
      details: { fields: issues },
      docs: 'https://og-engine.com/api-reference/errors#invalid_request',
    }, 400);
  }

  const data = parsed.data;
  const t0 = performance.now();

  const fmt = FORMATS[data.format];
  const fontEntry = getFontByName(data.font);
  const ff = fontEntry.family;
  const s = Math.max(fmt.w, fmt.h) / 1200;
  const px = Math.round(64 * s);
  const cW = fmt.w - px * 2;

  // Title measurement
  const tFont = `800 ${Math.round(data.titleSize * s)}px ${ff}`;
  const tLines = measureLines(data.title, tFont, cW);
  const maxT = data.maxTitleLines ?? fmt.maxTitleLines;
  const titleOverflow = tLines.length > maxT;

  // Description measurement
  let descResult = undefined;
  if (data.description) {
    const dFont = `400 ${Math.round(data.descSize * s)}px ${ff}`;
    const dLines = measureLines(data.description, dFont, cW);
    const maxD = data.maxDescLines ?? fmt.maxDescLines;
    const descOverflow = dLines.length > maxD;
    descResult = {
      lines: dLines.length,
      maxLines: maxD,
      overflow: descOverflow,
    };
  }

  const computeTimeMs = Number((performance.now() - t0).toFixed(2));
  const fits = !titleOverflow && (!descResult || !descResult.overflow);

  return c.json({
    fits,
    title: {
      lines: tLines.length,
      maxLines: maxT,
      overflow: titleOverflow,
    },
    ...(descResult ? { description: descResult } : {}),
    computeTimeMs,
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun run test -- tests/api/validate.test.ts
```

Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/validate.ts tests/api/validate.test.ts
git commit -m "feat(api): add POST /validate endpoint — free, unlimited text-fit checking"
```

---

## Task 10: API — Render Endpoint

**Files:**
- Create: `src/api/render.ts`
- Create: `tests/api/render.test.ts`

Matches `POST /render` from `docs/site/src/content/docs/api-reference/render.mdx`. Returns a PNG binary with metadata headers.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/render.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { renderRoute } from '../src/api/render';
import { registerFonts } from '../src/engine/fonts';
import { join } from 'path';

const app = new Hono();
app.route('/', renderRoute);

beforeAll(async () => {
  await registerFonts(join(import.meta.dir, '..', 'fonts'));
});

function post(body: unknown) {
  return app.request('/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /render', () => {
  it('returns a PNG image with correct Content-Type', async () => {
    const res = await post({ format: 'og', title: 'Hello, OG Engine' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns render metadata in headers', async () => {
    const res = await post({ format: 'og', title: 'Test Title' });
    expect(res.headers.get('X-Render-Time-Ms')).toBeTruthy();
    expect(res.headers.get('X-Title-Lines')).toBeTruthy();
    expect(res.headers.get('X-Desc-Lines')).toBeTruthy();
    expect(res.headers.get('X-Layout-Overflow')).toBeTruthy();
  });

  it('returns PNG binary data', async () => {
    const res = await post({ format: 'og', title: 'Test Title' });
    const buf = Buffer.from(await res.arrayBuffer());
    // PNG magic bytes
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it('returns 400 for missing format', async () => {
    const res = await post({ title: 'Hello' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_request');
  });

  it('returns 400 for missing title', async () => {
    const res = await post({ format: 'og' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid font', async () => {
    const res = await post({
      format: 'og',
      title: 'Hello',
      style: { font: 'NonexistentFont' },
    });
    expect(res.status).toBe(400);
  });

  it('accepts full style customization', async () => {
    const res = await post({
      format: 'og',
      title: 'Styled Image',
      description: 'With custom styles.',
      author: 'Author',
      tag: 'Tag',
      style: {
        accent: '#67e8f9',
        layout: 'center',
        font: 'Inter',
        titleSize: 56,
        descSize: 24,
        gradient: 'deep-sea',
      },
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun run test -- tests/api/render.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create render.ts**

```typescript
// src/api/render.ts
import { Hono } from 'hono';
import { renderSchema } from '../schemas/request';
import { renderCard } from '../engine/renderer';

export const renderRoute = new Hono();

renderRoute.post('/render', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json({
      error: 'invalid_request',
      message: 'Request body must be valid JSON.',
      docs: 'https://og-engine.com/api-reference/errors#invalid_request',
    }, 400);
  }

  const parsed = renderSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return c.json({
      error: 'invalid_request',
      message: issues[0]?.message ?? 'Validation failed.',
      details: { fields: issues },
      docs: 'https://og-engine.com/api-reference/errors#invalid_request',
    }, 400);
  }

  const data = parsed.data;
  const t0 = performance.now();

  const result = renderCard({
    title: data.title,
    description: data.description,
    author: data.author,
    tag: data.tag,
    format: data.format,
    accent: data.style.accent,
    layout: data.style.layout,
    titleSize: data.style.titleSize,
    descSize: data.style.descSize,
    fontName: data.style.font,
    gradient: data.style.gradient,
    bgImageBuffer: null,
    overlayOpacity: data.style.overlayOpacity,
  });

  const renderTimeMs = (performance.now() - t0).toFixed(2);

  return new Response(result.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'X-Render-Time-Ms': renderTimeMs,
      'X-Title-Lines': String(result.titleVisibleLines),
      'X-Desc-Lines': String(result.descVisibleLines),
      'X-Layout-Overflow': String(result.overflow),
    },
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun run test -- tests/api/render.test.ts
```

Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/render.ts tests/api/render.test.ts
git commit -m "feat(api): add POST /render endpoint — returns PNG with metadata headers"
```

---

## Task 11: HTTP Server Entry Point

**Files:**
- Create: `src/index.ts`

Wires all routes together, registers fonts on startup, starts the Hono server.

- [ ] **Step 1: Create src/index.ts**

```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { registerFonts } from './engine/fonts';
import { healthRoute } from './api/health';
import { validateRoute } from './api/validate';
import { renderRoute } from './api/render';
import { join } from 'path';

const app = new Hono();

// CORS — allow playground and external clients
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Render-Time-Ms', 'X-Title-Lines', 'X-Desc-Lines', 'X-Layout-Overflow'],
}));

// Mount routes
app.route('/', healthRoute);
app.route('/', validateRoute);
app.route('/', renderRoute);

// 404 fallback
app.notFound((c) => {
  return c.json({
    error: 'not_found',
    message: `No route matches ${c.req.method} ${c.req.path}`,
    docs: 'https://og-engine.com/api-reference/overview',
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'server_error',
    message: 'An unexpected error occurred.',
    docs: 'https://og-engine.com/api-reference/errors#server_error',
  }, 500);
});

// Start
const PORT = Number(process.env.PORT ?? 3000);
const FONTS_DIR = join(import.meta.dir, '..', 'fonts');

async function start() {
  await registerFonts(FONTS_DIR);
  console.log(`OG Engine listening on http://localhost:${PORT}`);
}

start();

export default {
  port: PORT,
  fetch: app.fetch,
};
```

- [ ] **Step 2: Test the server starts**

```bash
timeout 5 bun run src/index.ts || true
```

Expected: Output includes `Registered N font families` and `OG Engine listening on http://localhost:3000`.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up Hono server with health, validate, and render routes"
```

---

## Task 12: Manual Smoke Test

No files created — this verifies the full stack works end-to-end.

- [ ] **Step 1: Start the server in the background**

```bash
bun run src/index.ts &
SERVER_PID=$!
sleep 1
```

- [ ] **Step 2: Test GET /health**

```bash
curl -s http://localhost:3000/health | head -c 500
```

Expected: JSON with `status: "ok"`, fonts list, formats, templates, version.

- [ ] **Step 3: Test POST /validate**

```bash
curl -s -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{"format": "og", "title": "Will this headline fit?"}' | head -c 500
```

Expected: JSON with `fits: true`, title line info, computeTimeMs.

- [ ] **Step 4: Test POST /render**

```bash
curl -s -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"format": "og", "title": "Hello, OG Engine"}' \
  --output /tmp/test-og.png

file /tmp/test-og.png
```

Expected: `test-og.png: PNG image data, 1200 x 630`.

- [ ] **Step 5: Test error handling**

```bash
curl -s -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"title": "No format"}' | head -c 500
```

Expected: 400 with `error: "invalid_request"`.

- [ ] **Step 6: Stop the server**

```bash
kill $SERVER_PID 2>/dev/null
```

- [ ] **Step 7: Run all tests**

```bash
bun run test
```

Expected: All tests pass.

---

## Task 13: Performance Benchmark

**Files:**
- Create: `tests/benchmark.ts`

Quick benchmark to verify we're in the documented ~2-5ms range per render.

- [ ] **Step 1: Create the benchmark**

```typescript
// tests/benchmark.ts
import { registerFonts } from '../src/engine/fonts';
import { renderCard, type RenderOptions } from '../src/engine/renderer';
import { join } from 'path';

await registerFonts(join(import.meta.dir, '..', 'fonts'));

const options: RenderOptions = {
  title: 'Server-Side Text Layout Without a Browser',
  description: 'Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images.',
  author: 'OG Engine',
  tag: 'Benchmark',
  format: 'og',
  accent: '#38ef7d',
  layout: 'left',
  titleSize: 48,
  descSize: 22,
  fontName: 'Outfit',
  gradient: 'void',
  bgImageBuffer: null,
  overlayOpacity: 0.65,
};

// Warmup
for (let i = 0; i < 10; i++) {
  renderCard(options);
}

// Benchmark
const iterations = 100;
const times: number[] = [];

for (let i = 0; i < iterations; i++) {
  const t0 = performance.now();
  renderCard(options);
  times.push(performance.now() - t0);
}

times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b) / times.length;
const p50 = times[Math.floor(times.length * 0.5)];
const p95 = times[Math.floor(times.length * 0.95)];
const p99 = times[Math.floor(times.length * 0.99)];
const min = times[0];
const max = times[times.length - 1];

console.log(`\nOG Engine Benchmark (${iterations} iterations)`);
console.log('─'.repeat(40));
console.log(`  Min:  ${min.toFixed(2)} ms`);
console.log(`  P50:  ${p50.toFixed(2)} ms`);
console.log(`  P95:  ${p95.toFixed(2)} ms`);
console.log(`  P99:  ${p99.toFixed(2)} ms`);
console.log(`  Max:  ${max.toFixed(2)} ms`);
console.log(`  Avg:  ${avg.toFixed(2)} ms`);
console.log(`  Puppeteer equivalent: ~850ms → ${(850 / avg).toFixed(0)}x speedup`);
```

- [ ] **Step 2: Run the benchmark**

```bash
bun run tests/benchmark.ts
```

Expected: P50 under 10ms. Exact numbers depend on hardware. The key metric is the speedup multiplier vs. Puppeteer's ~850ms.

- [ ] **Step 3: Commit**

```bash
git add tests/benchmark.ts
git commit -m "feat: add performance benchmark (target: ~2-5ms per render)"
```

---

## Task 14: Playground API Integration

**Files:**
- Modify: `docs/site/src/components/Playground.tsx`
- Create: `docs/site/src/components/engine/api-client.ts`

Add an optional mode where the playground calls the real API instead of client-side rendering. The playground detects whether the API is available and shows a toggle.

- [ ] **Step 1: Create the API client**

```typescript
// docs/site/src/components/engine/api-client.ts

export interface ApiRenderResult {
  imageUrl: string;
  renderTimeMs: number;
  titleLines: number;
  descLines: number;
  overflow: boolean;
}

export async function apiRender(
  baseUrl: string,
  config: {
    format: string;
    title: string;
    description: string;
    author: string;
    tag: string;
    accent: string;
    layout: string;
    font: string;
    titleSize: number;
    descSize: number;
    gradient: string;
  },
): Promise<ApiRenderResult> {
  const res = await fetch(`${baseUrl}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: config.format,
      title: config.title,
      description: config.description,
      author: config.author,
      tag: config.tag,
      style: {
        accent: config.accent,
        layout: config.layout,
        font: config.font,
        titleSize: config.titleSize,
        descSize: config.descSize,
        gradient: config.gradient,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(err.message ?? `API error: ${res.status}`);
  }

  const blob = await res.blob();
  const imageUrl = URL.createObjectURL(blob);

  return {
    imageUrl,
    renderTimeMs: Number(res.headers.get('X-Render-Time-Ms') ?? '0'),
    titleLines: Number(res.headers.get('X-Title-Lines') ?? '0'),
    descLines: Number(res.headers.get('X-Desc-Lines') ?? '0'),
    overflow: res.headers.get('X-Layout-Overflow') === 'true',
  };
}

export async function checkApiAvailable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const body = await res.json();
    return body.status === 'ok';
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add API mode toggle to Playground.tsx**

Add the following state and UI to the existing Playground component. Insert after the existing imports at the top of the file:

```typescript
import { apiRender, checkApiAvailable } from './engine/api-client';
```

Add these state variables alongside the existing ones:

```typescript
const [useApi, setUseApi] = useState(false);
const [apiAvailable, setApiAvailable] = useState(false);
const [apiImageUrl, setApiImageUrl] = useState<string | null>(null);
const API_BASE = 'http://localhost:3000';
```

Add this effect to check API availability on mount:

```typescript
useEffect(() => {
  checkApiAvailable(API_BASE).then(setApiAvailable);
}, []);
```

Modify the existing render effect: when `useApi` is true, call `apiRender` instead of `renderCard`. When `useApi` is false, use the existing client-side rendering unchanged.

Add a toggle button in the preview column header (only visible when `apiAvailable` is true):

```tsx
{apiAvailable && (
  <button
    onClick={() => setUseApi(!useApi)}
    className="pg-picker-btn"
    style={{
      padding: '4px 10px', borderRadius: 6, fontSize: 10,
      border: `1px solid ${useApi ? accent : 'rgba(255,255,255,0.08)'}`,
      background: useApi ? accent + '15' : 'rgba(255,255,255,0.02)',
      color: useApi ? accent : '#64748b',
      cursor: 'pointer', fontFamily: 'var(--sl-font-mono)',
    }}
  >
    {useApi ? '⚡ API Mode' : '◻ Client Mode'}
  </button>
)}
```

When in API mode, display the returned image using `<img src={apiImageUrl}>` instead of the canvas.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/components/engine/api-client.ts docs/site/src/components/Playground.tsx
git commit -m "feat(playground): add optional API mode — calls real server when available"
```

---

## Task 15: Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
    testTimeout: 10000,
  },
});
```

- [ ] **Step 2: Run all tests**

```bash
bun run test
```

Expected: All tests pass (formats, text-measure, renderer, health, validate, render).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest configuration"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Project setup | `package.json`, `tsconfig.json` |
| 2 | Font download script | `scripts/download-fonts.ts` |
| 3 | Format & gradient defs | `src/engine/formats.ts`, `src/engine/gradients.ts` |
| 4 | Font registration | `src/engine/fonts.ts` |
| 5 | Text measurement | `src/engine/text-measure.ts` |
| 6 | Canvas renderer | `src/engine/renderer.ts` |
| 7 | Zod schemas | `src/schemas/request.ts` |
| 8 | GET /health | `src/api/health.ts` |
| 9 | POST /validate | `src/api/validate.ts` |
| 10 | POST /render | `src/api/render.ts` |
| 11 | Server entry point | `src/index.ts` |
| 12 | Smoke test | (manual verification) |
| 13 | Benchmark | `tests/benchmark.ts` |
| 14 | Playground API mode | `docs/site/src/components/engine/api-client.ts` |
| 15 | Vitest config | `vitest.config.ts` |

After completing all tasks, the server responds to the three core endpoints documented in the docs site (`/health`, `/validate`, `/render`), and the playground can toggle between client-side and API rendering.
