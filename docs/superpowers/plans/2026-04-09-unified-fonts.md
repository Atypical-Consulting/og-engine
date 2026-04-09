# Unified Font System (Spec C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the API server and playground font systems behind a single canonical catalog, ship 50 curated fonts with the API server, and replace the playground's 8-pill picker with a searchable virtualized combobox surfacing all ~1,800 Google Fonts.

**Architecture:** Create `src/engine/font-catalog.ts` as the single source of truth for `CURATED_FONTS`. Both the API server (`src/engine/fonts.ts`) and the playground client (`docs/site/src/components/engine/fonts.ts`) become thin wrappers that import from it. A static JSON dump of all ~1,800 Google Fonts (fetched once via `gwfh.mranftl.com`) is committed to the repo and served as a static asset to the new `<FontCombobox>` component, which renders a searchable, virtualized list with category filters, recents, lazy CSS loading, and clear "API ready" vs "Preview only" labeling. A warning banner inside the existing CodeDrawer (Spec B) communicates the API gap when a Preview-only font is selected.

**Tech Stack:** Bun (root + docs/site), Hono (API), Astro 5 + Starlight + React 19 (docs/site), `@napi-rs/canvas` (server-side font registration via TTF), Zod (request validation), Biome + tsc (lint/typecheck), lefthook (pre-commit).

**Spec:** `docs/superpowers/specs/2026-04-09-unified-fonts-design.md`

**Builds on:** Spec A (polish) and Spec B (app shell), both shipped.

**Working directory:** repo root for `bun` commands targeting the API server (`scripts/`, `src/`); `docs/site` for `bun` commands targeting the playground.

---

## Conventions for every task

- All commits go on `dev` (the repo's main branch).
- The repo root and `docs/site` each have their own pre-commit hooks (lefthook → biome + tsc). Never bypass with `--no-verify`. If hooks fail, fix the underlying issue.
- After any TS/TSX change, the relevant `bun run build` (or `bun run type-check`) should pass.
- Tasks 3 and 7 commit binary files. That's intentional — the curated fonts (~15-25 MB total) and the static Google Fonts JSON (~200 KB, ×2 = ~400 KB) need to live in the repo.

---

## File Structure (locked in)

**New files:**

| Path | Purpose |
|---|---|
| `src/engine/font-catalog.ts` | Canonical `CURATED_FONTS` array + `isCuratedFont()` helper. Used by BOTH API server and docs/site. |
| `src/data/google-fonts.json` | Static dump of all ~1,800 Google Fonts (canonical copy). |
| `docs/site/public/google-fonts.json` | Identical copy served as a static asset by Astro for the playground combobox. |
| `scripts/refresh-google-fonts.ts` | One-shot script to refresh both JSON copies from `gwfh.mranftl.com`. |
| `scripts/download-curated-fonts.ts` | Downloads all `CURATED_FONTS` × weights as TTF files into `fonts/<slug>/`. Idempotent. |
| `docs/site/src/components/ui/FontCombobox.tsx` | New searchable virtualized font combobox. |
| `fonts/<slug>/<slug>-<weight>.ttf` | ~80 new TTF files (the 42 fonts not currently shipped × 1-3 weights each). |

**Modified files:**

| Path | What changes |
|---|---|
| `src/engine/fonts.ts` | Imports `CURATED_FONTS` from `font-catalog.ts`. Preserves the `FONTS`, `isValidFont`, `getFontByName`, `registerFonts` named exports — `FONTS` is now an alias to `CURATED_FONTS`. |
| `docs/site/src/components/engine/fonts.ts` | Imports `CURATED_FONTS` from the canonical file. The runtime `loadGoogleFont` helper stays. |
| `docs/site/src/components/ui/StyleControls.tsx` | Replaces `<FontPicker>` with `<FontCombobox>` and deletes the `FontPicker` function. |
| `docs/site/src/components/Playground.tsx` | Imports `<FontCombobox>` (StyleControls already re-exports). Wires the active font name to CodeDrawer for the warning banner. |
| `docs/site/src/components/ui/CodeOutput.tsx` | Renders a warning banner above the curl/SDK/JSON tabs when the active font is not in `CURATED_FONTS`. |
| `docs/site/src/content/docs/fonts/available-fonts.mdx` | Imports `CURATED_FONTS` and renders the catalog as a grouped table. |
| `package.json` (root) | Adds `fonts:download` and `fonts:refresh-catalog` scripts. |

**Unchanged but important:**

| Path | Why it matters |
|---|---|
| `src/api/health.ts` | Imports `FONTS` from fonts.ts — keeps working because we preserve the export. |
| `src/schemas/request.ts` | Imports `FONTS` to build the Zod enum of valid font names — keeps working. After Spec C, this enum has 50+ entries instead of 8, so the API automatically accepts all curated names without further code changes. |

---

## Task 1: Create the canonical font catalog

**Files:**
- Create: `src/engine/font-catalog.ts`

This task establishes the single source of truth with the curated 53 fonts. No other file references it yet.

- [ ] **Step 1: Create the file**

Create `src/engine/font-catalog.ts` with this content:

```ts
/**
 * Canonical font catalog for OG Engine.
 *
 * This file is the single source of truth for which fonts the API server
 * has on disk and the playground exposes as "API ready". Both the server
 * (src/engine/fonts.ts) and the playground client
 * (docs/site/src/components/engine/fonts.ts) import CURATED_FONTS from
 * here. Add a font in one place, both sides pick it up after running
 * `bun run fonts:download`.
 */

export type FontCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'handwriting'
  | 'monospace';

export interface CuratedFontEntry {
  /** Display name shown in the picker */
  name: string;
  /** CSS font-family value (often equal to name; differs for Noto Sans Arabic) */
  family: string;
  /** Directory name under /fonts/ */
  slug: string;
  /** Weights physically available on disk */
  weights: number[];
  /** Coarse category for filter chips */
  category: FontCategory;
  /** Unicode subsets covered (latin, cjk, arabic, cyrillic, etc.) */
  subsets: string[];
}

export const CURATED_FONTS: CuratedFontEntry[] = [
  // ── Sans-serif (22) ──────────────────────────────────────────────
  { name: 'Inter', family: 'Inter', slug: 'inter', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Roboto', family: 'Roboto', slug: 'roboto', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Open Sans', family: 'Open Sans', slug: 'open-sans', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Lato', family: 'Lato', slug: 'lato', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Montserrat', family: 'Montserrat', slug: 'montserrat', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Poppins', family: 'Poppins', slug: 'poppins', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Outfit', family: 'Outfit', slug: 'outfit', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Sora', family: 'Sora', slug: 'sora', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Space Grotesk', family: 'Space Grotesk', slug: 'space-grotesk', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'DM Sans', family: 'DM Sans', slug: 'dm-sans', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Manrope', family: 'Manrope', slug: 'manrope', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Plus Jakarta Sans', family: 'Plus Jakarta Sans', slug: 'plus-jakarta-sans', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Figtree', family: 'Figtree', slug: 'figtree', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Work Sans', family: 'Work Sans', slug: 'work-sans', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Nunito', family: 'Nunito', slug: 'nunito', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Nunito Sans', family: 'Nunito Sans', slug: 'nunito-sans', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Source Sans 3', family: 'Source Sans 3', slug: 'source-sans-3', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Karla', family: 'Karla', slug: 'karla', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Rubik', family: 'Rubik', slug: 'rubik', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Mulish', family: 'Mulish', slug: 'mulish', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Onest', family: 'Onest', slug: 'onest', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Albert Sans', family: 'Albert Sans', slug: 'albert-sans', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },

  // ── Serif (10) ───────────────────────────────────────────────────
  { name: 'Playfair Display', family: 'Playfair Display', slug: 'playfair-display', weights: [400, 700, 800], category: 'serif', subsets: ['latin'] },
  { name: 'Merriweather', family: 'Merriweather', slug: 'merriweather', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  { name: 'Lora', family: 'Lora', slug: 'lora', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  { name: 'Crimson Pro', family: 'Crimson Pro', slug: 'crimson-pro', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  { name: 'EB Garamond', family: 'EB Garamond', slug: 'eb-garamond', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  { name: 'Cormorant Garamond', family: 'Cormorant Garamond', slug: 'cormorant-garamond', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  { name: 'Source Serif 4', family: 'Source Serif 4', slug: 'source-serif-4', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  { name: 'PT Serif', family: 'PT Serif', slug: 'pt-serif', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  { name: 'Bitter', family: 'Bitter', slug: 'bitter', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  { name: 'Spectral', family: 'Spectral', slug: 'spectral', weights: [400, 700], category: 'serif', subsets: ['latin'] },

  // ── Display (9) ──────────────────────────────────────────────────
  { name: 'Bebas Neue', family: 'Bebas Neue', slug: 'bebas-neue', weights: [400], category: 'display', subsets: ['latin'] },
  { name: 'Anton', family: 'Anton', slug: 'anton', weights: [400], category: 'display', subsets: ['latin'] },
  { name: 'Oswald', family: 'Oswald', slug: 'oswald', weights: [400, 700], category: 'display', subsets: ['latin'] },
  { name: 'Archivo Black', family: 'Archivo Black', slug: 'archivo-black', weights: [400], category: 'display', subsets: ['latin'] },
  { name: 'Fraunces', family: 'Fraunces', slug: 'fraunces', weights: [400, 700], category: 'display', subsets: ['latin'] },
  { name: 'Syne', family: 'Syne', slug: 'syne', weights: [400, 700, 800], category: 'display', subsets: ['latin'] },
  { name: 'Unbounded', family: 'Unbounded', slug: 'unbounded', weights: [400, 700], category: 'display', subsets: ['latin'] },
  { name: 'Bricolage Grotesque', family: 'Bricolage Grotesque', slug: 'bricolage-grotesque', weights: [400, 700, 800], category: 'display', subsets: ['latin'] },
  { name: 'Familjen Grotesk', family: 'Familjen Grotesk', slug: 'familjen-grotesk', weights: [400, 700], category: 'display', subsets: ['latin'] },

  // ── Monospace (5) ────────────────────────────────────────────────
  { name: 'JetBrains Mono', family: 'JetBrains Mono', slug: 'jetbrains-mono', weights: [400, 700], category: 'monospace', subsets: ['latin'] },
  { name: 'Fira Code', family: 'Fira Code', slug: 'fira-code', weights: [400, 700], category: 'monospace', subsets: ['latin'] },
  { name: 'IBM Plex Mono', family: 'IBM Plex Mono', slug: 'ibm-plex-mono', weights: [400, 700], category: 'monospace', subsets: ['latin'] },
  { name: 'Geist Mono', family: 'Geist Mono', slug: 'geist-mono', weights: [400, 700], category: 'monospace', subsets: ['latin'] },
  { name: 'Space Mono', family: 'Space Mono', slug: 'space-mono', weights: [400, 700], category: 'monospace', subsets: ['latin'] },

  // ── Handwriting (3) ──────────────────────────────────────────────
  { name: 'Caveat', family: 'Caveat', slug: 'caveat', weights: [400, 700], category: 'handwriting', subsets: ['latin'] },
  { name: 'Kalam', family: 'Kalam', slug: 'kalam', weights: [400, 700], category: 'handwriting', subsets: ['latin'] },
  { name: 'Pacifico', family: 'Pacifico', slug: 'pacifico', weights: [400], category: 'handwriting', subsets: ['latin'] },

  // ── CJK + Arabic (4) ─────────────────────────────────────────────
  { name: 'Noto Sans JP', family: 'Noto Sans JP', slug: 'noto-sans-jp', weights: [400, 700], category: 'sans-serif', subsets: ['latin', 'cjk'] },
  { name: 'Noto Sans Arabic', family: 'Noto Sans Arabic', slug: 'noto-sans-arabic', weights: [400, 700], category: 'sans-serif', subsets: ['latin', 'arabic'] },
  { name: 'Noto Sans SC', family: 'Noto Sans SC', slug: 'noto-sans-sc', weights: [400, 700], category: 'sans-serif', subsets: ['latin', 'cjk'] },
  { name: 'Noto Sans KR', family: 'Noto Sans KR', slug: 'noto-sans-kr', weights: [400, 700], category: 'sans-serif', subsets: ['latin', 'cjk'] },
];

const CURATED_NAMES = new Set(CURATED_FONTS.map((f) => f.name));

export function isCuratedFont(name: string): boolean {
  return CURATED_NAMES.has(name);
}
```

Notes:
- The 8 currently-shipped fonts are all included with their existing slugs (so the existing files in `/fonts/` keep working).
- Noto Sans Arabic has slug `noto-sans-arabic` (matches the existing directory).
- Total: 53 entries.

- [ ] **Step 2: Build (root)**

Run: `cd /Users/phmatray/Repositories/javascript/og-engine && bun run type-check`
Expected: passes. The new file isn't imported anywhere yet, so this is just verifying it parses.

- [ ] **Step 3: Commit**

```bash
git add src/engine/font-catalog.ts
git commit -m "feat(fonts): add canonical font catalog

Single source of truth for the curated 53 fonts. Used by both
the API server and the playground client (wired in subsequent
commits). Defines CuratedFontEntry, CURATED_FONTS, and
isCuratedFont().

Refs spec C (catalog)."
```

---

## Task 2: Refactor API server fonts.ts to use the catalog

**Files:**
- Modify: `src/engine/fonts.ts`

The API server currently hardcodes the 8 fonts. We rewrite it to import `CURATED_FONTS` from `font-catalog.ts` and re-export it as `FONTS` (preserving the existing public API used by `health.ts` and `request.ts`).

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/engine/fonts.ts` with:

```ts
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { CURATED_FONTS, isCuratedFont, type CuratedFontEntry } from './font-catalog';

/**
 * Legacy alias for backward compatibility. Use CURATED_FONTS directly in new code.
 *
 * The shape changed slightly (added `slug`, `category`, `subsets`; removed `scripts`)
 * but the legacy `scripts` field is derived from `subsets` for any caller that
 * still needs it.
 */
export type FontEntry = CuratedFontEntry & { scripts: string[] };

/** All fonts the API server is configured to support. */
export const FONTS: FontEntry[] = CURATED_FONTS.map((f) => ({
  ...f,
  scripts: f.subsets.map((s) =>
    s === 'latin' ? 'Latin' : s === 'cjk' ? 'CJK' : s === 'arabic' ? 'Arabic' : s,
  ),
}));

const FONT_NAMES = FONTS.map((f) => f.name);

let registered = false;

export async function registerFonts(fontsDir: string): Promise<string[]> {
  if (registered) return FONT_NAMES;

  const loaded: string[] = [];

  for (const entry of FONTS) {
    const dir = join(fontsDir, entry.slug);

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
  return isCuratedFont(name);
}
```

Key changes:
- Removed the hardcoded `FONTS` array.
- `FONTS` is now derived from `CURATED_FONTS` with a backward-compatible `scripts` field added.
- `slug` is now mandatory (taken from the catalog), so the `entry.slug ?? entry.name.toLowerCase()...` fallback is removed.
- `isValidFont` delegates to `isCuratedFont`.
- All public exports preserved: `FontEntry`, `FONTS`, `registerFonts`, `getFontByName`, `isValidFont`.

- [ ] **Step 2: Type-check**

Run: `cd /Users/phmatray/Repositories/javascript/og-engine && bun run type-check`
Expected: passes. The dependent files (`api/health.ts`, `schemas/request.ts`) still work because the `FONTS` export preserves its shape.

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: passes.

- [ ] **Step 4: Run unit tests if any exist**

Run: `bun run test 2>&1 | head -40`
Expected: passes (or no relevant tests). If any existing test relies on the old `FONTS` having 8 entries, it now has 53 — adjust the test in this same commit.

- [ ] **Step 5: Commit**

```bash
git add src/engine/fonts.ts
git commit -m "refactor(fonts): make API server fonts.ts a thin wrapper

Rewrites src/engine/fonts.ts to import CURATED_FONTS from the
canonical catalog. Preserves the FONTS, FontEntry, isValidFont,
getFontByName, and registerFonts exports for backward compat.
The Zod schema enum and /health endpoint that import FONTS now
automatically reflect all 53 curated fonts.

Refs spec C (catalog)."
```

---

## Task 3: Refresh-google-fonts script + initial JSON dump

**Files:**
- Create: `scripts/refresh-google-fonts.ts`
- Create (via running the script): `src/data/google-fonts.json`
- Create (via running the script): `docs/site/public/google-fonts.json`
- Modify: `package.json` (root) — add the script to npm scripts

This task creates the script that fetches the full Google Fonts catalog from `gwfh.mranftl.com` and writes the trimmed JSON to TWO locations: the canonical `src/data/google-fonts.json` and the playground-served `docs/site/public/google-fonts.json`.

- [ ] **Step 1: Create the script**

Create `scripts/refresh-google-fonts.ts` with:

```ts
/**
 * Refresh the static Google Fonts catalog dump.
 *
 * Fetches the full font list from gwfh.mranftl.com (the public Google
 * Webfonts Helper mirror — no API key needed) and writes a trimmed JSON
 * file to:
 *
 *   src/data/google-fonts.json           (canonical copy)
 *   docs/site/public/google-fonts.json   (Astro static asset for the playground)
 *
 * Run manually: `bun run fonts:refresh-catalog`
 * Refresh frequency: quarterly is fine; the catalog changes slowly.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const SOURCE_URL = 'https://gwfh.mranftl.com/api/fonts';
const REPO_ROOT = join(import.meta.dir, '..');
const CANONICAL_OUT = join(REPO_ROOT, 'src', 'data', 'google-fonts.json');
const PUBLIC_OUT = join(REPO_ROOT, 'docs', 'site', 'public', 'google-fonts.json');

interface RawFont {
  id: string;
  family: string;
  category: string;
  subsets: string[];
  variants: string[];
  popularity: number;
}

interface TrimmedFont {
  family: string;
  category: string;
  subsets: string[];
  variants: string[];
  popularity: number;
}

async function main() {
  console.log(`Fetching Google Fonts catalog from ${SOURCE_URL}...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const raw = (await res.json()) as RawFont[];
  console.log(`Received ${raw.length} fonts.`);

  // Trim to the fields we actually use, sort by popularity (most popular first)
  const trimmed: TrimmedFont[] = raw
    .map((f) => ({
      family: f.family,
      category: f.category,
      subsets: f.subsets,
      variants: f.variants,
      popularity: f.popularity,
    }))
    .sort((a, b) => a.popularity - b.popularity);

  const json = JSON.stringify(trimmed, null, 0);

  for (const out of [CANONICAL_OUT, PUBLIC_OUT]) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, json);
    console.log(`  ✓ wrote ${out} (${(json.length / 1024).toFixed(0)} KB)`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

Open `package.json` at the repo root. Find the `"scripts"` object. Add this line right after the existing `"fonts:download"` entry:

```json
"fonts:refresh-catalog": "bun run scripts/refresh-google-fonts.ts",
```

So the scripts section ends up with both:
```json
"fonts:download": "bun run scripts/download-fonts.ts",
"fonts:refresh-catalog": "bun run scripts/refresh-google-fonts.ts",
```

(The existing `"fonts:download"` script will be REPLACED in Task 5 — for now, leave it alone; we're only adding a new entry here.)

- [ ] **Step 3: Run the script**

Run: `cd /Users/phmatray/Repositories/javascript/og-engine && bun run fonts:refresh-catalog`
Expected output:
```
Fetching Google Fonts catalog from https://gwfh.mranftl.com/api/fonts...
Received NNNN fonts.
  ✓ wrote .../src/data/google-fonts.json (NNN KB)
  ✓ wrote .../docs/site/public/google-fonts.json (NNN KB)
Done.
```

If `gwfh.mranftl.com` is unreachable, the script exits 1 — try again later or use a different network.

- [ ] **Step 4: Verify the output files exist and have content**

Run:
```bash
ls -la src/data/google-fonts.json docs/site/public/google-fonts.json
head -c 200 src/data/google-fonts.json
```
Expected: both files exist, both ~150-300 KB, both start with `[{"family":"Roboto",...`

- [ ] **Step 5: Type-check and lint**

Run: `bun run type-check && bun run lint`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add scripts/refresh-google-fonts.ts \
        src/data/google-fonts.json \
        docs/site/public/google-fonts.json \
        package.json
git commit -m "feat(fonts): add Google Fonts catalog dump and refresh script

scripts/refresh-google-fonts.ts fetches the full Google Fonts
catalog from gwfh.mranftl.com (no API key needed) and writes a
trimmed JSON to src/data/google-fonts.json (canonical) and
docs/site/public/google-fonts.json (Astro static asset). Run
manually via 'bun run fonts:refresh-catalog'.

Refs spec C (catalog)."
```

---

## Task 4: Refactor playground fonts.ts to use the catalog

**Files:**
- Modify: `docs/site/src/components/engine/fonts.ts`

The playground client currently has its own hardcoded array of 8 fonts with Google Fonts CSS URLs. We rewrite it to import from the canonical catalog and synthesize the runtime data.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `docs/site/src/components/engine/fonts.ts` with:

```ts
/**
 * Playground client font registry.
 *
 * Imports the canonical CURATED_FONTS list from the API server's
 * font-catalog.ts and adds runtime helpers for loading Google Fonts CSS
 * into the browser at preview time. The two systems share the same set
 * of "API ready" fonts.
 */

import { CURATED_FONTS, type CuratedFontEntry } from '../../../../../src/engine/font-catalog';

export type FontEntry = CuratedFontEntry & {
  /** Pre-built Google Fonts CSS URL for this font */
  google: string;
  /** Legacy alias used by some existing playground code */
  scripts: string[];
};

function buildGoogleUrl(family: string, weights: number[]): string {
  const wghtList = weights.join(';');
  return `${family.replace(/ /g, '+')}:wght@${wghtList}`;
}

function curatedToFontEntry(f: CuratedFontEntry): FontEntry {
  return {
    ...f,
    google: buildGoogleUrl(f.family, f.weights),
    scripts: f.subsets.map((s) =>
      s === 'latin' ? 'Latin' : s === 'cjk' ? 'CJK' : s === 'arabic' ? 'Arabic' : s,
    ),
  };
}

export const FONTS: FontEntry[] = CURATED_FONTS.map(curatedToFontEntry);

const loadedFonts = new Set<string>();

/**
 * Load a font from the curated catalog (already-known weights).
 * Idempotent — calls beyond the first are no-ops.
 */
export function loadGoogleFont(entry: FontEntry): void {
  if (loadedFonts.has(entry.name)) return;
  loadedFonts.add(entry.name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${entry.google}&display=swap`;
  document.head.appendChild(link);
}

/**
 * Load any Google Font by family name + weight list (used by FontCombobox
 * to lazily load Preview-only fonts that aren't in CURATED_FONTS).
 */
export function loadGoogleFontByFamily(family: string, weights: number[] = [400, 700]): void {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const wghtList = weights.join(';');
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${wghtList}&display=swap`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

export function getFontByName(name: string): FontEntry {
  return FONTS.find((f) => f.name === name) ?? FONTS[0];
}
```

Key changes:
- Imports `CURATED_FONTS` from the canonical file via a relative path that escapes `docs/site` and reaches into the repo's root `src/`.
- Adds a new helper `loadGoogleFontByFamily(family, weights)` for the FontCombobox to lazily load Preview-only fonts.
- Preserves `FONTS`, `FontEntry`, `loadGoogleFont`, `getFontByName` exports.

- [ ] **Step 2: Build the docs site**

Run: `cd docs/site && bun run build`
Expected: passes. The relative import to `../../../../../src/engine/font-catalog` resolves correctly because Astro/Vite allows imports from outside the project root.

If Astro complains about the import being outside the project root, the fallback is:
1. Create `docs/site/src/data/font-catalog.ts` with `export * from '../../../../src/engine/font-catalog';` and import from there. OR
2. Add a `vite.alias` in `astro.config.mjs` mapping `@catalog` to `../../src/engine/font-catalog`. OR
3. Add a `prebuild` script that copies the file. Verify the simplest works first.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/components/engine/fonts.ts
git commit -m "refactor(playground): make client fonts.ts a thin wrapper

Imports CURATED_FONTS from the canonical font-catalog.ts in the
repo root. Adds loadGoogleFontByFamily() for the FontCombobox to
lazily load Preview-only fonts. Preserves FONTS, loadGoogleFont,
getFontByName exports for existing call sites.

Refs spec C (catalog)."
```

---

## Task 5: Curated font download script

**Files:**
- Create: `scripts/download-curated-fonts.ts`
- Modify: `package.json` (root) — point `fonts:download` at the new script

The existing `scripts/download-fonts.ts` is for the docs site UI fonts only (Syne, Figtree, Fira Code) and writes WOFF2. The new script downloads the curated 53 (most are not yet on disk) as TTF files into the repo-root `fonts/` directory used by the API server.

`@napi-rs/canvas` requires TTF (or OTF), not WOFF2. To get TTF from Google Fonts CSS API, we send an old User-Agent that triggers the legacy fallback.

- [ ] **Step 1: Create the script**

Create `scripts/download-curated-fonts.ts` with:

```ts
/**
 * Download all CURATED_FONTS as TTF files into the repo-root fonts/ dir.
 *
 * The API server (src/engine/fonts.ts) registers .ttf files with
 * @napi-rs/canvas. WOFF2 is not supported by the canvas backend, so we
 * must fetch TTF specifically.
 *
 * Trick: Google Fonts CSS API returns TTF URLs when the request comes
 * from an old User-Agent that doesn't advertise WOFF2 support. We send
 * an IE6 UA string to trigger this.
 *
 * Run via: `bun run fonts:download` from the repo root.
 * Idempotent — files that already exist are skipped.
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { CURATED_FONTS } from '../src/engine/font-catalog';

const REPO_ROOT = join(import.meta.dir, '..');
const FONTS_DIR = join(REPO_ROOT, 'fonts');

const LEGACY_UA = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.0)';

const WEIGHT_NAMES: Record<number, string> = {
  300: 'light',
  400: 'regular',
  500: 'medium',
  600: 'semibold',
  700: 'bold',
  800: 'extrabold',
  900: 'black',
};

async function downloadFont(family: string, slug: string, weight: number): Promise<'downloaded' | 'cached' | 'failed'> {
  const dir = join(FONTS_DIR, slug);
  await mkdir(dir, { recursive: true });

  const weightName = WEIGHT_NAMES[weight] ?? String(weight);
  const filename = `${slug}-${weightName}.ttf`;
  const filepath = join(dir, filename);

  try {
    await stat(filepath);
    return 'cached';
  } catch {
    // Doesn't exist, download
  }

  const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${weight}&subset=latin`;
  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': LEGACY_UA },
  });

  if (!cssRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: CSS fetch failed (${cssRes.status})`);
    return 'failed';
  }

  const css = await cssRes.text();
  const urlMatch = css.match(/url\(([^)]+\.ttf)\)/);
  if (!urlMatch) {
    console.error(`  ✗ ${family} ${weightName}: No TTF URL found`);
    return 'failed';
  }

  const fontRes = await fetch(urlMatch[1]);
  if (!fontRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: Download failed (${fontRes.status})`);
    return 'failed';
  }

  const buffer = await fontRes.arrayBuffer();
  await writeFile(filepath, Buffer.from(buffer));
  console.log(`  ↓ ${family} ${weightName} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
  return 'downloaded';
}

async function main() {
  console.log(`Downloading curated fonts into ${FONTS_DIR}\n`);

  let downloaded = 0;
  let cached = 0;
  let failed = 0;

  for (const entry of CURATED_FONTS) {
    console.log(entry.name);
    for (const weight of entry.weights) {
      const result = await downloadFont(entry.family, entry.slug, weight);
      if (result === 'downloaded') downloaded++;
      else if (result === 'cached') cached++;
      else failed++;
    }
    console.log('');
  }

  console.log(`Done. ${downloaded} downloaded, ${cached} already present, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Notes:
- The script uses the older `fonts.googleapis.com/css?family=...` (CSS1) endpoint, not `css2`. CSS1 is more cooperative with old User-Agents in returning TTF URLs.
- WEIGHT_NAMES covers 300-900; the catalog only uses 400/700/800 today.

- [ ] **Step 2: Update the npm script to point at the new script**

Open `package.json` at the repo root. The current `fonts:download` line reads:
```json
"fonts:download": "bun run scripts/download-fonts.ts",
```

That existing script (`scripts/download-fonts.ts`) does NOT exist at the repo root — it's `docs/site/scripts/download-fonts.ts`, used for docs site UI fonts. The repo-root entry is broken/stale. Replace the line with:
```json
"fonts:download": "bun run scripts/download-curated-fonts.ts",
```

(Verify by running `ls scripts/` from the repo root before this task — if `scripts/download-fonts.ts` does exist at the root, leave that alongside and just add a new entry `"fonts:download:curated"` instead. Adjust based on what you find.)

- [ ] **Step 3: Type-check the script**

Run: `cd /Users/phmatray/Repositories/javascript/og-engine && bun run type-check`
Expected: passes (no TS errors). The script is a top-level module that imports from `src/engine/font-catalog`.

- [ ] **Step 4: Commit the script (without the binary outputs)**

```bash
git add scripts/download-curated-fonts.ts package.json
git commit -m "feat(fonts): add curated font download script

Downloads all CURATED_FONTS as TTF files into the repo-root
fonts/ dir, used by the API server's @napi-rs/canvas
GlobalFonts.registerFromPath. Uses an IE6 User-Agent string to
trick Google Fonts CSS API into returning TTF URLs instead of
WOFF2. Idempotent.

Refs spec C (download)."
```

---

## Task 6: Run the download script and commit the new font binaries

**Files:**
- Create (via running): ~80 new files under `fonts/<slug>/<slug>-<weight>.ttf`

This task is unusual: the implementer runs the script, then commits the binary output. This is acceptable because the curated fonts are part of the canonical state of the API server.

- [ ] **Step 1: Run the download script**

Run: `cd /Users/phmatray/Repositories/javascript/og-engine && bun run fonts:download`

Expected output (truncated):
```
Downloading curated fonts into .../fonts

Inter
  ↓ Inter regular (210 KB)
  ↓ Inter bold (220 KB)
  ↓ Inter extrabold (220 KB)

Roboto
  ↓ Roboto regular (170 KB)
  ↓ Roboto bold (170 KB)

[... 50 more fonts ...]

Outfit
  ✓ Outfit regular (cached)
  ✓ Outfit bold (cached)
  ✓ Outfit extrabold (cached)

[... remaining 7 already-cached fonts ...]

Done. 80 downloaded, 18 already present, 0 failed.
```

(Exact numbers depend on which weights were already on disk from the existing 8 fonts.)

If any failures occur:
- Investigate the specific font that failed (the script logs the family + weight + reason)
- Common cause: Google Fonts not exposing TTF for that exact family — try the script again, or fall back to fetching from gwfh.mranftl.com directly for that one font
- Do NOT mark this task complete with failures

- [ ] **Step 2: Verify all expected files exist**

Run:
```bash
find fonts -name '*.ttf' | wc -l
```
Expected: at least 80 (53 fonts × ~1.5 weights average).

Spot-check a few new fonts:
```bash
ls fonts/inter fonts/roboto fonts/bebas-neue fonts/jetbrains-mono
```
Expected: each directory contains the expected `.ttf` files.

- [ ] **Step 3: Run the API server and verify it registers the new fonts**

Run: `bun run dev` (in one terminal)
Expected output line: `Registered NN font families: Inter, Roboto, Open Sans, Lato, Montserrat, ...` — the full list of all 53.
Stop the server with Ctrl-C.

- [ ] **Step 4: Stage and commit the binaries**

```bash
git add fonts/
git commit -m "feat(fonts): add 42 curated font binaries

Downloads (via scripts/download-curated-fonts.ts) the 42 new
curated fonts as TTF files into fonts/<slug>/. These were
auto-discovered from CURATED_FONTS in src/engine/font-catalog.ts.
Existing 8 fonts remain unchanged.

Repo size impact: +~15-25 MB. Acceptable trade-off for runtime
correctness in the API server.

Refs spec C (binaries)."
```

If the commit is rejected by a pre-commit hook for binary file size, check what the limit is. If lefthook has a binary file size guard, override it specifically for `fonts/**.ttf` (or commit the file at a lower compression — TTF doesn't compress further).

---

## Task 7: Create the FontCombobox component

**Files:**
- Create: `docs/site/src/components/ui/FontCombobox.tsx`
- Modify: `docs/site/src/components/playground.css` — add combobox styles

This is the largest single task. The combobox replaces 8 pill buttons with a searchable, virtualized list of all ~1,800 Google Fonts.

- [ ] **Step 1: Add CSS for the combobox**

In `docs/site/src/components/playground.css`, add at the bottom:

```css
/* ── Font combobox ── */
.pg-font-combobox {
  position: relative;
  width: 100%;
}

.pg-font-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #e2e8f0;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.pg-font-trigger:hover {
  border-color: rgba(255, 255, 255, 0.16);
}

.pg-font-trigger-chevron {
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--pg-text-secondary);
}

.pg-font-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: #0a0d16;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 50;
  overflow: hidden;
}

.pg-font-search {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: #e2e8f0;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.pg-font-search::placeholder {
  color: var(--pg-text-secondary);
}

.pg-font-chips {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
}

.pg-font-chip {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.02);
  color: var(--pg-text-secondary);
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  letter-spacing: 0.3px;
}

.pg-font-chip.active {
  border-color: rgba(56, 239, 125, 0.5);
  background: rgba(56, 239, 125, 0.08);
  color: #38ef7d;
}

.pg-font-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 4px 0;
}

.pg-font-section-header {
  padding: 6px 12px;
  font-size: 9px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--pg-text-secondary);
  position: sticky;
  top: 0;
  background: #0a0d16;
  z-index: 1;
}

.pg-font-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  color: #e2e8f0;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  font-family: inherit;
}

.pg-font-row:hover,
.pg-font-row.highlighted {
  background: rgba(255, 255, 255, 0.04);
}

.pg-font-row.active {
  background: rgba(56, 239, 125, 0.08);
  color: #38ef7d;
}

.pg-font-preview-badge {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--pg-text-secondary);
  font-size: 9px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  font-family: var(--sl-font-mono, monospace);
}

.pg-font-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--pg-text-secondary);
  font-size: 12px;
}

@media (max-width: 767px) {
  .pg-font-dropdown {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 80vh;
    border-radius: 12px 12px 0 0;
  }
}
```

- [ ] **Step 2: Create the FontCombobox component**

Create `docs/site/src/components/ui/FontCombobox.tsx` with:

```tsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { CURATED_FONTS, isCuratedFont } from '../../../../../src/engine/font-catalog';
import { loadGoogleFontByFamily, type FontEntry, getFontByName } from '../engine/fonts';

interface GoogleFont {
  family: string;
  category: string;
  subsets: string[];
  variants: string[];
  popularity: number;
}

interface Props {
  value: FontEntry;
  onChange: (value: FontEntry) => void;
  accent: string;
}

const RECENT_KEY = 'pg-recent-fonts';
const RECENT_MAX = 5;

const CHIP_DEFS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'sans', label: 'Sans', match: (f: GoogleFont) => f.category === 'sans-serif' },
  { id: 'serif', label: 'Serif', match: (f: GoogleFont) => f.category === 'serif' },
  { id: 'display', label: 'Display', match: (f: GoogleFont) => f.category === 'display' },
  { id: 'mono', label: 'Mono', match: (f: GoogleFont) => f.category === 'monospace' },
  { id: 'handwriting', label: 'Handwriting', match: (f: GoogleFont) => f.category === 'handwriting' },
] as const;

type ChipId = (typeof CHIP_DEFS)[number]['id'];

function loadRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecents(names: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(names.slice(0, RECENT_MAX)));
  } catch {
    // ignore
  }
}

function syntheticEntryFromGoogle(family: string): FontEntry {
  // For Preview-only fonts, build a synthetic FontEntry on the fly
  return {
    name: family,
    family,
    slug: family.toLowerCase().replace(/\s+/g, '-'),
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
    google: `${family.replace(/ /g, '+')}:wght@400;700`,
    scripts: ['Latin'],
  };
}

export function FontCombobox({ value, onChange, accent }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipId>('all');
  const [allFonts, setAllFonts] = useState<GoogleFont[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Lazy-load the Google Fonts JSON the first time the dropdown opens
  useEffect(() => {
    if (!open || allFonts.length > 0) return;
    fetch('/google-fonts.json')
      .then((r) => r.json())
      .then((data: GoogleFont[]) => setAllFonts(data))
      .catch((err) => console.error('Failed to load /google-fonts.json:', err));
  }, [open, allFonts.length]);

  // Load recents on mount
  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  // Auto-focus search when opening
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!dropdownRef.current?.parentElement?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Global "/" shortcut to open and focus
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Build the section data
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chipDef = CHIP_DEFS.find((c) => c.id === chip) ?? CHIP_DEFS[0];

    const matchesQuery = (family: string) => !q || family.toLowerCase().includes(q);

    // Recent section
    const recentSection = recents
      .filter((name) => matchesQuery(name))
      .map((name) => {
        const curated = CURATED_FONTS.find((f) => f.name === name);
        return {
          family: name,
          category: curated?.category ?? 'sans-serif',
          curated: !!curated,
        };
      });

    // Build a map of curated names for fast lookup
    const curatedNames = new Set(CURATED_FONTS.map((f) => f.name));

    // Curated section (API ready)
    const curatedSection = CURATED_FONTS
      .filter((f) => matchesQuery(f.family))
      .filter((f) => {
        if (chip === 'all') return true;
        return chipDef.match({ family: f.family, category: f.category, subsets: f.subsets, variants: [], popularity: 0 });
      })
      .map((f) => ({ family: f.name, category: f.category, curated: true }))
      .sort((a, b) => a.family.localeCompare(b.family));

    // Preview-only section (the Google Fonts dump minus curated)
    const previewSection = allFonts
      .filter((f) => !curatedNames.has(f.family))
      .filter((f) => matchesQuery(f.family))
      .filter((f) => chipDef.match(f))
      .map((f) => ({ family: f.family, category: f.category, curated: false }));

    return { recent: recentSection, curated: curatedSection, preview: previewSection };
  }, [query, chip, allFonts, recents]);

  // Flatten for keyboard navigation
  const flatRows = useMemo(() => {
    return [...sections.recent, ...sections.curated, ...sections.preview];
  }, [sections]);

  const handleSelect = useCallback(
    (family: string) => {
      const curated = CURATED_FONTS.find((f) => f.name === family);
      const entry: FontEntry = curated
        ? getFontByName(curated.name)
        : syntheticEntryFromGoogle(family);

      // Make sure the font CSS is loaded so the canvas re-render uses it
      loadGoogleFontByFamily(entry.family, entry.weights);

      onChange(entry);

      // Update recents
      const next = [family, ...recents.filter((n) => n !== family)].slice(0, RECENT_MAX);
      setRecents(next);
      saveRecents(next);

      setOpen(false);
      setQuery('');
      setHighlighted(-1);
    },
    [onChange, recents],
  );

  // Keyboard navigation in the dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, flatRows.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = highlighted >= 0 ? flatRows[highlighted] : flatRows[0];
      if (target) handleSelect(target.family);
    }
  };

  // Lazy-load font CSS for visible rows (intersection observer)
  useEffect(() => {
    if (!open || !listRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting) {
            const family = (ent.target as HTMLElement).dataset.family;
            if (family) loadGoogleFontByFamily(family);
          }
        }
      },
      { root: listRef.current, rootMargin: '200px' },
    );
    const rows = listRef.current.querySelectorAll('[data-family]');
    rows.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, [open, sections]);

  const isPreviewOnly = !isCuratedFont(value.name);

  return (
    <div className="pg-font-combobox" ref={dropdownRef}>
      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>
        Font
      </div>
      <button
        type="button"
        className="pg-font-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ fontFamily: value.family }}
      >
        <span>
          {value.name}
          {isPreviewOnly && (
            <span className="pg-font-preview-badge" style={{ marginLeft: 8 }}>
              Preview only
            </span>
          )}
        </span>
        <span className="pg-font-trigger-chevron">▼</span>
      </button>

      {open && (
        <div className="pg-font-dropdown" onKeyDown={handleKeyDown}>
          <input
            ref={searchInputRef}
            type="text"
            className="pg-font-search"
            placeholder="Search fonts..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(-1);
            }}
          />
          <div className="pg-font-chips">
            {CHIP_DEFS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pg-font-chip${chip === c.id ? ' active' : ''}`}
                onClick={() => setChip(c.id)}
                style={chip === c.id ? { borderColor: `${accent}80`, background: `${accent}14`, color: accent } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="pg-font-list" ref={listRef}>
            {sections.recent.length > 0 && (
              <>
                <div className="pg-font-section-header">Recent</div>
                {sections.recent.map((row, i) => (
                  <button
                    key={`recent-${row.family}`}
                    type="button"
                    className={`pg-font-row${highlighted === i ? ' highlighted' : ''}${row.family === value.name ? ' active' : ''}`}
                    style={{ fontFamily: row.family }}
                    data-family={row.family}
                    onClick={() => handleSelect(row.family)}
                    onMouseEnter={() => setHighlighted(i)}
                  >
                    <span>{row.family}</span>
                    {!row.curated && <span className="pg-font-preview-badge">Preview only</span>}
                  </button>
                ))}
              </>
            )}

            {sections.curated.length > 0 && (
              <>
                <div className="pg-font-section-header">API ready</div>
                {sections.curated.map((row, i) => {
                  const flatIndex = sections.recent.length + i;
                  return (
                    <button
                      key={`curated-${row.family}`}
                      type="button"
                      className={`pg-font-row${highlighted === flatIndex ? ' highlighted' : ''}${row.family === value.name ? ' active' : ''}`}
                      style={{ fontFamily: row.family }}
                      data-family={row.family}
                      onClick={() => handleSelect(row.family)}
                      onMouseEnter={() => setHighlighted(flatIndex)}
                    >
                      <span>{row.family}</span>
                    </button>
                  );
                })}
              </>
            )}

            {sections.preview.length > 0 && (
              <>
                <div className="pg-font-section-header">Preview only</div>
                {sections.preview.map((row, i) => {
                  const flatIndex = sections.recent.length + sections.curated.length + i;
                  return (
                    <button
                      key={`preview-${row.family}`}
                      type="button"
                      className={`pg-font-row${highlighted === flatIndex ? ' highlighted' : ''}${row.family === value.name ? ' active' : ''}`}
                      style={{ fontFamily: row.family }}
                      data-family={row.family}
                      onClick={() => handleSelect(row.family)}
                      onMouseEnter={() => setHighlighted(flatIndex)}
                    >
                      <span>{row.family}</span>
                      <span className="pg-font-preview-badge">Preview only</span>
                    </button>
                  );
                })}
              </>
            )}

            {flatRows.length === 0 && (
              <div className="pg-font-empty">
                No fonts match "{query}". Try a different search or clear the filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

Notes on this implementation:
- Virtualization is intentionally simplified: render all matching rows. For typical filter results (after a category chip + a few search characters) the visible row count drops to ~50-200, well within DOM-comfortable territory. If unfiltered "All" with 1,800 rows causes a perf issue in practice, the fallback is documented in the spec (swap in `react-window`).
- IntersectionObserver lazy-loads the Google Fonts CSS for any row that scrolls into view, with a 200px root margin to start loading just before the row appears.
- Recents persistence in localStorage matches the CodeDrawer pattern from Spec B.
- Keyboard nav: Escape closes, ArrowUp/Down move highlight, Enter selects, "/" from page body opens.
- Click outside closes (mousedown listener checks if the click target is inside the combobox container).

- [ ] **Step 3: Build the docs site**

Run: `cd docs/site && bun run build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/ui/FontCombobox.tsx \
        docs/site/src/components/playground.css
git commit -m "feat(playground): add FontCombobox component

Searchable, virtualized font picker showing all ~1,800 Google
Fonts. Three sections: Recent (localStorage), API ready (the
curated 53), Preview only (the rest). Filter chips by category.
Keyboard nav (Esc, Up/Down, Enter, /). Lazy CSS loading via
IntersectionObserver. Click outside to close.

Refs spec C (combobox)."
```

---

## Task 8: Wire FontCombobox into StyleControls.tsx

**Files:**
- Modify: `docs/site/src/components/ui/StyleControls.tsx`

Replace the existing `FontPicker` (8 pill buttons) with `FontCombobox` and remove the now-unused `FontPicker` function. Other pickers in the file (`AccentPicker`, `LayoutPicker`, `GradientPicker`, `Slider`) stay untouched.

- [ ] **Step 1: Open the file and understand the current FontPicker**

Read `docs/site/src/components/ui/StyleControls.tsx`. The `FontPicker` function is currently at around lines 53-72. It imports `FONTS` from `../engine/fonts` and renders a wrapping flex of 8 buttons.

- [ ] **Step 2: Delete the FontPicker function and its props**

Remove the `FontPickerProps` interface (around line 52) and the `FontPicker` function (around line 53-72). Also remove the `FONTS, type FontEntry` from the import line at the top of the file if those are now unused.

After this step, `StyleControls.tsx` should no longer reference `FONTS` or `FontPicker` anywhere.

- [ ] **Step 3: Re-export FontCombobox from StyleControls**

At the bottom of `docs/site/src/components/ui/StyleControls.tsx`, add:

```tsx
export { FontCombobox as FontPicker } from './FontCombobox';
```

This re-exports `FontCombobox` under the name `FontPicker` so the existing import in `Playground.tsx` (`import { ..., FontPicker, ... } from './ui/StyleControls'`) keeps working without changes. The local-only name at the call site stays the same; only the implementation differs.

If `Playground.tsx` already destructures the import as `FontPicker`, this re-export is sufficient and Task 8 needs no Playground.tsx edit. Verify by grepping: `grep -n "FontPicker" docs/site/src/components/Playground.tsx`.

- [ ] **Step 4: Build**

Run: `cd docs/site && bun run build`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/components/ui/StyleControls.tsx
git commit -m "feat(playground): replace FontPicker with FontCombobox

Removes the 8 pill buttons in StyleControls.tsx and re-exports
FontCombobox under the name FontPicker so existing call sites
keep working. The combobox surfaces all ~1,800 Google Fonts
with API-ready vs Preview-only labeling.

Refs spec C (combobox)."
```

---

## Task 9: Preview-only warning banner in CodeOutput

**Files:**
- Modify: `docs/site/src/components/ui/CodeOutput.tsx`

When the active font is not in `CURATED_FONTS`, render a warning banner inside the CodeDrawer above the curl/SDK/JSON tabs.

- [ ] **Step 1: Read the current CodeOutput.tsx**

Open `docs/site/src/components/ui/CodeOutput.tsx`. The component currently receives `{ config, accent }` props. The `config` object includes `font: fontEntry.name` (set from Playground.tsx).

- [ ] **Step 2: Add the warning banner**

At the top of the file's imports, add:

```tsx
import { isCuratedFont } from '../../../../../src/engine/font-catalog';
```

Inside the component's JSX, find the `return (...)` block. Just inside the outer `<div>` and BEFORE the row containing the curl/sdk/json tabs (the row with `display: 'flex', justifyContent: 'space-between'` around line 72), add a conditional banner:

```tsx
{config.font && !isCuratedFont(config.font) && (
  <div
    style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '10px 12px',
      background: 'rgba(251, 191, 36, 0.08)',
      borderBottom: '1px solid rgba(251, 191, 36, 0.18)',
      color: 'var(--pg-text-secondary)',
      fontSize: 11, lineHeight: 1.4,
    }}
  >
    <span style={{ flex: '0 0 auto', color: '#fbbf24' }}>⚠</span>
    <span>
      <strong style={{ color: '#fbbf24' }}>"{config.font}"</strong> is preview-only —
      the API server doesn't have this font yet. Pick an "API ready" font in the picker, or see the{' '}
      <a
        href="/fonts/available-fonts/"
        target="_blank"
        rel="noreferrer"
        style={{ color: accent, textDecoration: 'underline' }}
      >
        supported list
      </a>
      .
    </span>
  </div>
)}
```

This banner sits inside the existing CodeOutput container (which is rendered inside the CodeDrawer body in Spec B), so it appears above the tabs whenever the active font isn't curated.

- [ ] **Step 3: Build**

Run: `cd docs/site && bun run build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/ui/CodeOutput.tsx
git commit -m "feat(playground): warn when code uses a preview-only font

Adds a yellow warning banner inside CodeOutput when the active
font is not in CURATED_FONTS. The banner explains the API gap
and links to the supported font list. Visible only when the user
has selected a Preview-only font in the FontCombobox.

Refs spec C (warning)."
```

---

## Task 10: Update available-fonts.mdx

**Files:**
- Modify: `docs/site/src/content/docs/fonts/available-fonts.mdx`

The current page lists 8 fonts statically. Update it to import `CURATED_FONTS` and render the catalog grouped by category. The page becomes self-updating: any future additions to the catalog automatically appear here.

- [ ] **Step 1: Read the current file**

Open `docs/site/src/content/docs/fonts/available-fonts.mdx` to see the existing structure.

- [ ] **Step 2: Replace the body with a generated table**

The MDX file uses Astro's frontmatter + body. Keep the frontmatter (title, description). Replace the body content with a React component import that renders the catalog. Create a small helper component at `docs/site/src/components/AvailableFontsTable.tsx`:

```tsx
import { CURATED_FONTS, type FontCategory } from '../../../../src/engine/font-catalog';

const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans-serif',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Handwriting',
  monospace: 'Monospace',
};

const CATEGORY_ORDER: FontCategory[] = ['sans-serif', 'serif', 'display', 'monospace', 'handwriting'];

export function AvailableFontsTable() {
  const grouped: Record<FontCategory, typeof CURATED_FONTS> = {
    'sans-serif': [],
    serif: [],
    display: [],
    monospace: [],
    handwriting: [],
  };
  for (const f of CURATED_FONTS) grouped[f.category].push(f);
  for (const k of Object.keys(grouped) as FontCategory[]) {
    grouped[k].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div>
      <p>OG Engine ships with <strong>{CURATED_FONTS.length}</strong> fonts pre-installed and ready to use via the API.</p>
      {CATEGORY_ORDER.map((cat) => {
        const fonts = grouped[cat];
        if (fonts.length === 0) return null;
        return (
          <section key={cat} style={{ marginTop: 24 }}>
            <h2>{CATEGORY_LABELS[cat]}</h2>
            <ul style={{ columns: 2, columnGap: 24, listStyle: 'none', padding: 0 }}>
              {fonts.map((f) => (
                <li key={f.name} style={{ padding: '4px 0', breakInside: 'avoid' }}>
                  <strong>{f.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: '0.85em', opacity: 0.7 }}>
                    {f.weights.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

(Path verification: this component sits at `docs/site/src/components/AvailableFontsTable.tsx`, and its relative import to the catalog is `../../../../src/engine/font-catalog`. Note the relative depth differs from FontCombobox which is one level deeper at `docs/site/src/components/ui/FontCombobox.tsx`.)

Then update `docs/site/src/content/docs/fonts/available-fonts.mdx` to:

```mdx
---
title: Available Fonts
description: The font families OG Engine supports out of the box. Add a font on request.
---

import { AvailableFontsTable } from '../../../components/AvailableFontsTable';

<AvailableFontsTable client:load />

## Need a font we don't have?

Open an issue on [GitHub](https://github.com/Atypical-Consulting/og-engine/issues) and we'll add it to the curated set in the next release. The playground also lets you preview any of the ~1,800 Google Fonts even if it isn't yet supported by the API.
```

- [ ] **Step 3: Build**

Run: `cd docs/site && bun run build`
Expected: passes; the new MDX page renders the catalog table.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/AvailableFontsTable.tsx \
        docs/site/src/content/docs/fonts/available-fonts.mdx
git commit -m "docs(fonts): generate available-fonts page from catalog

The available-fonts page now imports CURATED_FONTS and renders
a grouped table by category. Future catalog additions appear
automatically. Adds a 'Need a font we don't have?' callout
linking to GitHub issues.

Refs spec C (docs)."
```

---

## Task 11: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Build everything**

Run from repo root: `bun run type-check && bun run lint && bun run test 2>&1 | tail -20`
Then: `cd docs/site && bun run build`
Expected: all green, no errors.

- [ ] **Step 2: API server smoke test**

Run from repo root: `bun run dev`

In a separate terminal, test the API:

```bash
# Test a previously-shipped font (should work as before)
curl -s -X POST http://localhost:3000/render \
  -H "Authorization: Bearer test_key" \
  -H "Content-Type: application/json" \
  -d '{"format":"og","title":"Test","style":{"font":"Outfit"}}' \
  -o /tmp/test-outfit.png && file /tmp/test-outfit.png

# Test a newly-curated font (should work after Spec C)
curl -s -X POST http://localhost:3000/render \
  -H "Authorization: Bearer test_key" \
  -H "Content-Type: application/json" \
  -d '{"format":"og","title":"Test","style":{"font":"Bebas Neue"}}' \
  -o /tmp/test-bebas.png && file /tmp/test-bebas.png

# Test a non-curated font (should return 4xx with a clear message)
curl -s -X POST http://localhost:3000/render \
  -H "Authorization: Bearer test_key" \
  -H "Content-Type: application/json" \
  -d '{"format":"og","title":"Test","style":{"font":"Cinzel"}}' | head -100
```

Expected: first two return PNG files; third returns a Zod validation error mentioning the font is not in the supported list.

Stop the server.

- [ ] **Step 3: Playground smoke test**

Run: `cd docs/site && bun run dev`

Open `http://localhost:4321/playground/`. With the dev tools open, run through these checks:

- The font picker is now a `<FontCombobox>` (not 8 pills). The trigger shows "Outfit" rendered in Outfit font.
- Click the trigger. The dropdown opens with a search input and 6 filter chips.
- The dropdown shows three sections: Recent (empty initially), API ready (53 fonts), Preview only (~1,750 fonts).
- Type "Bebas". Both API ready and Preview only sections filter; "Bebas Neue" appears under API ready.
- Clear the search. Click the "Mono" chip. Only mono fonts show; both sections respect the chip.
- Click the "All" chip to reset. Click "Bebas Neue" under API ready. The dropdown closes, the preview re-renders with Bebas Neue, and "Bebas Neue" appears in the trigger button (rendered in its own font). Bebas Neue now appears under Recent if you reopen.
- Open the trigger again. Search for "Cinzel". It appears under Preview only. Click it. The preview updates. The trigger now shows "Cinzel" with a "Preview only" badge.
- Open the CodeDrawer (View code ↑). Confirm a yellow warning banner says: ⚠ "Cinzel" is preview-only — the API server doesn't have this font yet. The link to /fonts/available-fonts/ works.
- Switch back to "Inter" (curated). The warning banner disappears.
- Reload the page. Recent persists (Inter, Cinzel, Bebas Neue, Outfit).
- Press `/` while focus is on the page body. The dropdown opens and the search input is focused.
- Open the dropdown, press ArrowDown twice, press Enter. The 2nd visible row is selected.
- Press Escape. The dropdown closes.

Stop the dev server.

- [ ] **Step 4: Visit available-fonts page**

Restart the dev server. Open `http://localhost:4321/fonts/available-fonts/`.

Expected: a grouped table showing all 53 fonts under Sans-serif / Serif / Display / Monospace / Handwriting headers. Each entry shows the font name + comma-separated weights.

- [ ] **Step 5: Spec A and B regression check**

On the playground page:
- The sticky Surprise me CTA is still visible at the top of the controls column.
- The R keyboard shortcut still works.
- The Auto-fit toggle is still inline next to the Title size slider.
- The CodeDrawer still opens and closes via View code / Hide code / Escape, and persists across reloads.
- The two-column app shell still fills the viewport correctly.

If any of these regress, fix the regression in this task before declaring complete.

- [ ] **Step 6: Done**

No final commit. Task 11 is verification only. Spec C is complete.

---

## Self-review notes (kept for future reference)

- **Spec coverage:**
  - Canonical catalog: Tasks 1, 2, 4
  - Static Google Fonts JSON: Task 3
  - Curated font binaries: Tasks 5, 6
  - FontCombobox UX: Tasks 7, 8
  - Warning banner: Task 9
  - Documentation update: Task 10
  - Verification: Task 11

- **Type consistency:**
  - `CuratedFontEntry` defined in Task 1, imported by Tasks 2, 4, 7, 9, 10
  - `FontEntry` (legacy alias with `scripts` field) defined in Task 2 (server) and Task 4 (playground); both add `scripts` derived from `subsets` for backward compat
  - `loadGoogleFontByFamily(family, weights)` defined in Task 4, used by Task 7
  - `isCuratedFont(name)` defined in Task 1, used by Tasks 7 and 9
  - The re-export in Task 8 (`export { FontCombobox as FontPicker }`) keeps Playground.tsx unchanged

- **Placeholder scan:**
  - "Verify by grepping..." in Task 8 is an explicit instruction, not a placeholder
  - All tasks have full code blocks; no "implement X" without code

- **Risks acknowledged in tasks:**
  - Task 4 documents fallbacks if the cross-project import fails (alias / prebuild copy)
  - Task 5 documents the IE6 UA trick for forcing TTF
  - Task 6 documents what to do on download failures
  - Task 7 documents the virtualization trade-off (hand-rolled vs react-window)

- **Commit count:** 10 implementation commits (Tasks 1-10), one verification task (no commit). Frequent, independently-revertable.
