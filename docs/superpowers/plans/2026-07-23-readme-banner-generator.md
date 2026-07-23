# README Banner Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded `readme-banner` template + a batch CLI to og-engine that generates and commits a consistent banner image into every repo across two GitHub accounts.

**Architecture:** A new built-in template renders a 1280×640 banner (repo name, tagline, per-owner wordmark, language-colored accent, star count). A phased CLI collects repo metadata via `gh`, renders each banner in-process with `renderCard`, emits an HTML contact sheet for QA, then (opt-in) commits `.github/banner.png` + a README reference and opens one PR per repo. Pure logic (tagline extraction, render-input building, language colors) is split from I/O (gh, git) so it is unit-testable.

**Tech Stack:** Bun, TypeScript, Hono (existing), `@napi-rs/canvas`, vitest, biome, `gh` CLI.

## Global Constraints

- Runtime: **Bun**; scripts run via `bun run <path>`. Tests via `vitest run`.
- Lint/format: **biome** (`bun run lint`) — prefer template literals over string concatenation; a pre-commit lefthook runs `biome check` + `tsc --noEmit`, both must pass.
- Type-check: `tsc --noEmit` must pass (strict).
- Language colors use the **GitHub linguist palette**; unknown/`null` language → default accent `#38ef7d`.
- Banner format: **1280×640** (`readme` format key). Committed path: **`.github/banner.png`**. README reference: `![<repo> banner](.github/banner.png)` inserted as the first line if absent.
- Per-owner wordmark: `phmatray` → `Philippe Matray`; `Atypical-Consulting` → `Atypical Consulting`; otherwise the owner login.
- Nothing is committed to external repos without the `--commit` flag; default run is render + contact sheet only.
- Fonts must be present: run `bun run fonts:download` once before rendering (registers `Outfit`, `JetBrains Mono`, etc.).

---

### Task 1: Language → color map

**Files:**
- Create: `src/engine/language-colors.ts`
- Test: `tests/engine/language-colors.test.ts`

**Interfaces:**
- Produces: `languageColor(lang: string | null | undefined): string`, `DEFAULT_ACCENT: string`, `LANGUAGE_COLORS: Record<string, string>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/language-colors.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENT, languageColor } from '../../src/engine/language-colors';

describe('languageColor', () => {
  it('maps known languages case-insensitively', () => {
    expect(languageColor('C#')).toBe('#178600');
    expect(languageColor('typescript')).toBe('#3178c6');
    expect(languageColor('Rust')).toBe('#dea584');
    expect(languageColor('Python')).toBe('#3572A5');
  });
  it('falls back to the default accent for unknown or null', () => {
    expect(languageColor(null)).toBe(DEFAULT_ACCENT);
    expect(languageColor(undefined)).toBe(DEFAULT_ACCENT);
    expect(languageColor('Brainfuck')).toBe(DEFAULT_ACCENT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/engine/language-colors.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/language-colors`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/language-colors.ts
// GitHub linguist colors for the languages present across the portfolio.
export const LANGUAGE_COLORS: Record<string, string> = {
  'c#': '#178600',
  typescript: '#3178c6',
  javascript: '#f1e05a',
  rust: '#dea584',
  java: '#b07219',
  python: '#3572A5',
  html: '#e34c26',
  css: '#563d7c',
  scss: '#c6538c',
  shell: '#89e051',
  go: '#00ADD8',
  dockerfile: '#384d54',
  tex: '#3D6117',
  gdscript: '#355570',
  swift: '#F05138',
  kotlin: '#A97BFF',
  vue: '#41b883',
  'c++': '#f34b7d',
  c: '#555555',
  ruby: '#701516',
  php: '#4F5D95',
};

export const DEFAULT_ACCENT = '#38ef7d';

export function languageColor(lang: string | null | undefined): string {
  if (!lang) return DEFAULT_ACCENT;
  return LANGUAGE_COLORS[lang.toLowerCase()] ?? DEFAULT_ACCENT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/engine/language-colors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/language-colors.ts tests/engine/language-colors.test.ts
git commit -m "feat(engine): add language->color map for banners"
```

---

### Task 2: `readme` banner format (1280×640)

**Files:**
- Modify: `src/engine/formats.ts` (add one entry to `FORMATS`)
- Test: `tests/engine/formats.test.ts`

**Interfaces:**
- Produces: `FORMATS.readme` with `{ w: 1280, h: 640, maxTitleLines: 2, maxDescLines: 3 }`; `FormatKey` now includes `'readme'`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/formats.test.ts
import { describe, expect, it } from 'vitest';
import { FORMATS } from '../../src/engine/formats';

describe('readme format', () => {
  it('exposes a 1280x640 banner format', () => {
    expect(FORMATS.readme).toMatchObject({ w: 1280, h: 640, maxTitleLines: 2, maxDescLines: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/engine/formats.test.ts`
Expected: FAIL — `FORMATS.readme` is `undefined`.

- [ ] **Step 3: Add the format entry**

In `src/engine/formats.ts`, add this line inside the `FORMATS` object (after the `story` entry):

```ts
  readme: { w: 1280, h: 640, label: 'README', ratio: '1280x640', maxTitleLines: 2, maxDescLines: 3 },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/engine/formats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/formats.ts tests/engine/formats.test.ts
git commit -m "feat(engine): add 1280x640 readme banner format"
```

---

### Task 3: `readme-banner` template

**Files:**
- Create: `src/engine/templates/readme-banner.ts`
- Modify: `src/engine/templates/index.ts` (import + register)
- Test: `tests/engine/readme-banner.test.ts`

**Interfaces:**
- Consumes: `TemplateFn`, `TemplateInput` from `./types`; helpers `paintBackgroundMesh`, `rgba`, `fitTitleLines` from `./helpers`; `measureLines`, `measureTextWidth` from `../text-measure`.
- Reads `input.variables`: `owner`, `wordmark`, `language`, `stars`, `repoPath`, `monoFamily`. Reads `input.content.title` (repo name, may include an emoji prefix) and `input.content.description` (tagline).
- Produces: `readmeBannerTemplate: TemplateFn`; registered under key `'readme-banner'` in `TEMPLATES`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/readme-banner.test.ts
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerFonts } from '../../src/engine/fonts';
import { renderCard } from '../../src/engine/renderer';

beforeAll(async () => {
  await registerFonts(join(process.cwd(), 'fonts'));
});

function baseOptions(overrides = {}) {
  return {
    title: 'FormCraft',
    description: 'Dynamic forms for Blazor — fluent + attribute-based',
    author: '', tag: '',
    format: 'readme' as const,
    template: 'readme-banner',
    accent: '#178600',
    layout: 'left' as const,
    titleSize: 64, descSize: 26,
    fontName: 'Outfit',
    gradient: 'void',
    bgImageBuffer: null,
    overlayOpacity: 0.65,
    autoFit: false,
    outputFormat: 'png' as const,
    variables: {
      owner: 'phmatray', wordmark: 'Philippe Matray', language: 'C#',
      stars: '53', repoPath: 'github.com/phmatray/FormCraft', monoFamily: 'JetBrains Mono',
    },
    namedImages: {},
    outputQuality: 90,
    ...overrides,
  };
}

describe('readme-banner template', () => {
  it('renders a 1280x640 PNG', async () => {
    const res = await renderCard(baseOptions());
    expect(res.width).toBe(1280);
    expect(res.height).toBe(640);
    expect(res.buffer.length).toBeGreaterThan(2000);
  });

  it('flags overflow when the repo name is far too long', async () => {
    const res = await renderCard(baseOptions({
      title: 'ThisRepositoryNameIsAbsurdlyLongAndWillNotFitOnTwoLinesNoMatterWhat AnotherWord AndMore',
    }));
    expect(res.overflow).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/engine/readme-banner.test.ts`
Expected: FAIL — `getTemplate('readme-banner')` falls back to `default`; the 1280×640 assertions may pass but `overflow` on a 2-line-max name will not behave as designed, and the template file does not exist yet. (If both assertions coincidentally pass via the default template, the test is still meaningful once Step 3 registers the real template.)

- [ ] **Step 3: Create the template and register it**

```ts
// src/engine/templates/readme-banner.ts
import { measureLines, measureTextWidth } from '../text-measure';
import { fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const readmeBannerTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style } = input;
  const { title, description } = content;
  const { accent, fontFamily: ff } = style;
  const s = Math.max(W, H) / 1200;

  const owner = input.variables?.owner ?? '';
  const wordmark = input.variables?.wordmark || owner;
  const language = input.variables?.language ?? '';
  const stars = input.variables?.stars ?? '';
  const repoPath = input.variables?.repoPath ?? '';
  const mono = input.variables?.monoFamily || ff;

  // Background: dark void mesh tinted by the language accent.
  paintBackgroundMesh(ctx, W, H, 'void', accent);

  const px = Math.round(80 * s);
  const cW = W - px * 2;
  const topY = Math.round(64 * s);
  const markSize = Math.round(18 * s);

  // --- Top-left: diamond mark + wordmark ---
  ctx.save();
  ctx.translate(px + markSize / 2, topY + markSize / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = accent;
  ctx.fillRect(-markSize / 2, -markSize / 2, markSize, markSize);
  ctx.restore();

  const wmFont = `700 ${Math.round(19 * s)}px ${ff}`;
  ctx.font = wmFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(230,237,243,0.92)';
  ctx.fillText(wordmark.toUpperCase(), px + markSize + Math.round(14 * s), topY + markSize / 2);

  // --- Top-right: language chip (dot + label) ---
  if (language) {
    const chipFont = `600 ${Math.round(16 * s)}px ${ff}`;
    ctx.font = chipFont;
    const labelW = measureTextWidth(language, chipFont);
    const dotR = Math.round(6 * s);
    const padX = Math.round(16 * s);
    const gap = Math.round(9 * s);
    const chipH = Math.round(34 * s);
    const chipW = padX * 2 + dotR * 2 + gap + labelW;
    const chipX = W - px - chipW;
    const chipY = topY + markSize / 2 - chipH / 2;

    ctx.fillStyle = rgba(accent, 0.12);
    roundRect(ctx, chipX, chipY, chipW, chipH, Math.round(chipH / 2));
    ctx.fill();

    const cy = topY + markSize / 2;
    ctx.beginPath();
    ctx.arc(chipX + padX + dotR, cy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();

    ctx.fillStyle = 'rgba(230,237,243,0.92)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = chipFont;
    ctx.fillText(language, chipX + padX + dotR * 2 + gap, cy);
  }

  // --- Repo name (large, bold) ---
  const titleTopY = topY + markSize + Math.round(56 * s);
  const { lines: tLines, fontSize: eff } = fitTitleLines(
    title || '', ff, style.titleSize, 800, cW, fmt.maxTitleLines, s,
  );
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.12 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e6edf3';
  ctx.font = tFont;
  let yPos = titleTopY;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '…';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }

  // --- Tagline ---
  const dFont = `400 ${Math.round(style.descSize * s)}px ${ff}`;
  const dLH = Math.round(style.descSize * 1.5 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const visibleD = dLines.slice(0, fmt.maxDescLines);
  yPos += Math.round(18 * s);
  ctx.font = dFont;
  ctx.fillStyle = 'rgba(139,148,158,0.92)';
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > fmt.maxDescLines) t += '…';
    ctx.fillText(t, px, yPos);
    yPos += dLH;
  }

  // --- Bottom bar: separator, mono repo path, star count ---
  const bottomY = H - Math.round(64 * s);
  ctx.strokeStyle = rgba(accent, 0.18);
  ctx.lineWidth = Math.round(1 * s);
  ctx.beginPath();
  ctx.moveTo(px, bottomY - Math.round(22 * s));
  ctx.lineTo(W - px, bottomY - Math.round(22 * s));
  ctx.stroke();

  const pathFont = `500 ${Math.round(16 * s)}px ${mono}`;
  ctx.font = pathFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(139,148,158,0.9)';
  ctx.fillText(repoPath, px, bottomY);

  if (stars) {
    const starFont = `600 ${Math.round(17 * s)}px ${ff}`;
    ctx.font = starFont;
    const starChar = '★';
    const countW = measureTextWidth(stars, starFont);
    const starW = measureTextWidth(starChar, starFont);
    const gap = Math.round(7 * s);
    const totalW = starW + gap + countW;
    const startX = W - px - totalW;
    ctx.textAlign = 'left';
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.fillText(starChar, startX, bottomY);
    ctx.fillStyle = 'rgba(230,237,243,0.9)';
    ctx.fillText(stars, startX + starW + gap, bottomY);
  }

  const overflow = tLines.length > fmt.maxTitleLines || dLines.length > fmt.maxDescLines;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
};

function roundRect(
  ctx: import('@napi-rs/canvas').SKRSContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
```

Then register it in `src/engine/templates/index.ts`:

1. Add the import beside the other template imports:
```ts
import { readmeBannerTemplate } from './readme-banner';
```
2. Add the entry inside the `TEMPLATES` object:
```ts
  'readme-banner': readmeBannerTemplate,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/engine/readme-banner.test.ts`
Expected: PASS (2 tests). If fonts are missing, run `bun run fonts:download` first.

- [ ] **Step 5: Commit**

```bash
git add src/engine/templates/readme-banner.ts src/engine/templates/index.ts tests/engine/readme-banner.test.ts
git commit -m "feat(engine): add readme-banner template"
```

---

### Task 4: Tagline extraction from README

**Files:**
- Create: `scripts/banners/tagline.ts`
- Test: `tests/scripts/tagline.test.ts`

**Interfaces:**
- Produces: `extractTagline(markdown: string): string | null` — the first human-readable line, or `null` if none.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scripts/tagline.test.ts
import { describe, expect, it } from 'vitest';
import { extractTagline } from '../../scripts/banners/tagline';

describe('extractTagline', () => {
  it('returns the first prose line, skipping headings/badges/blanks', () => {
    const md = [
      '# FormCraft',
      '',
      '![build](https://img.shields.io/badge/build-passing-green)',
      '[![nuget](https://img.shields.io/nuget/v/x)](https://nuget.org/x)',
      '',
      'Dynamic forms for **Blazor** — fluent + attribute-based.',
      '',
      '## Features',
    ].join('\n');
    expect(extractTagline(md)).toBe('Dynamic forms for Blazor — fluent + attribute-based.');
  });

  it('skips HTML comment blocks and centered <p> tags', () => {
    const md = ['<!-- a comment', 'still comment -->', '<p align="center">', 'The pitch line.'].join('\n');
    expect(extractTagline(md)).toBe('The pitch line.');
  });

  it('accepts a blockquote tagline', () => {
    expect(extractTagline('# X\n\n> The fastest way to do Y.')).toBe('The fastest way to do Y.');
  });

  it('returns null when there is no prose line', () => {
    expect(extractTagline('# OnlyHeading\n\n## AnotherHeading')).toBeNull();
    expect(extractTagline('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/scripts/tagline.test.ts`
Expected: FAIL — cannot resolve `../../scripts/banners/tagline`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/banners/tagline.ts
// Extract the first human-readable line of a README, for use as a banner tagline.
export function extractTagline(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let inComment = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      continue;
    }
    if (line.startsWith('<!--')) {
      if (!line.includes('-->')) inComment = true;
      continue;
    }
    if (line.startsWith('#')) continue; // headings
    if (line.startsWith('![') || line.startsWith('[![')) continue; // images / linked badges
    if (/^\[[^\]]*\]\([^)]*\)$/.test(line)) continue; // a bare link line
    if (/^<[^>]+>$/.test(line)) continue; // a lone html tag (e.g. <p align="center">)
    if (/^[-*=_]{3,}$/.test(line)) continue; // horizontal rule
    const text = line.startsWith('>') ? line.replace(/^>\s?/, '') : line;
    return stripInlineMd(text);
  }
  return null;
}

function stripInlineMd(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // inline images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[*_`]/g, '') // emphasis / code ticks
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/scripts/tagline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/banners/tagline.ts tests/scripts/tagline.test.ts
git commit -m "feat(banners): extract tagline from README first line"
```

---

### Task 5: Build render options from a repo descriptor

**Files:**
- Create: `scripts/banners/render-input.ts`
- Test: `tests/scripts/render-input.test.ts`

**Interfaces:**
- Consumes: `RenderOptions` from `../../src/engine/renderer`; `languageColor` from `../../src/engine/language-colors`.
- Produces:
  - `interface BannerOverride { tagline?: string; accent?: string; emoji?: string; wordmark?: string }`
  - `interface RepoDescriptor { owner: string; name: string; description: string | null; language: string | null; stars: number; tagline: string | null; override?: BannerOverride | null }`
  - `buildBannerRenderOptions(repo: RepoDescriptor): RenderOptions`
  - `formatStars(n: number): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scripts/render-input.test.ts
import { describe, expect, it } from 'vitest';
import { buildBannerRenderOptions, formatStars } from '../../scripts/banners/render-input';

const base = {
  owner: 'phmatray', name: 'FormCraft',
  description: 'gh description', language: 'C#', stars: 53,
  tagline: 'Dynamic forms for Blazor', override: null,
};

describe('buildBannerRenderOptions', () => {
  it('maps owner to wordmark, language to accent, and fills variables', () => {
    const o = buildBannerRenderOptions(base);
    expect(o.template).toBe('readme-banner');
    expect(o.format).toBe('readme');
    expect(o.accent).toBe('#178600');
    expect(o.description).toBe('Dynamic forms for Blazor');
    expect(o.variables?.wordmark).toBe('Philippe Matray');
    expect(o.variables?.repoPath).toBe('github.com/phmatray/FormCraft');
    expect(o.variables?.stars).toBe('53');
  });

  it('uses the Atypical wordmark for the org owner', () => {
    const o = buildBannerRenderOptions({ ...base, owner: 'Atypical-Consulting' });
    expect(o.variables?.wordmark).toBe('Atypical Consulting');
  });

  it('applies overrides (tagline, accent, emoji, wordmark) with precedence', () => {
    const o = buildBannerRenderOptions({
      ...base,
      override: { tagline: 'Custom pitch', accent: '#8844AE', emoji: '🎨', wordmark: 'PM' },
    });
    expect(o.description).toBe('Custom pitch');
    expect(o.accent).toBe('#8844AE');
    expect(o.title).toBe('🎨 FormCraft');
    expect(o.variables?.wordmark).toBe('PM');
  });

  it('falls back tagline -> description -> empty', () => {
    expect(buildBannerRenderOptions({ ...base, tagline: null }).description).toBe('gh description');
    expect(buildBannerRenderOptions({ ...base, tagline: null, description: null }).description).toBe('');
  });
});

describe('formatStars', () => {
  it('formats thousands compactly', () => {
    expect(formatStars(53)).toBe('53');
    expect(formatStars(1650)).toBe('1.7k');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/scripts/render-input.test.ts`
Expected: FAIL — cannot resolve `../../scripts/banners/render-input`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/banners/render-input.ts
import { languageColor } from '../../src/engine/language-colors';
import type { RenderOptions } from '../../src/engine/renderer';

export interface BannerOverride {
  tagline?: string;
  accent?: string;
  emoji?: string;
  wordmark?: string;
}

export interface RepoDescriptor {
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  tagline: string | null;
  override?: BannerOverride | null;
}

const WORDMARKS: Record<string, string> = {
  phmatray: 'Philippe Matray',
  'Atypical-Consulting': 'Atypical Consulting',
};

export function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function buildBannerRenderOptions(repo: RepoDescriptor): RenderOptions {
  const o = repo.override ?? {};
  const tagline = o.tagline ?? repo.tagline ?? repo.description ?? '';
  const wordmark = o.wordmark ?? WORDMARKS[repo.owner] ?? repo.owner;
  const accent = o.accent ?? languageColor(repo.language);
  const title = o.emoji ? `${o.emoji} ${repo.name}` : repo.name;

  return {
    title,
    description: tagline,
    author: '',
    tag: '',
    format: 'readme',
    template: 'readme-banner',
    accent,
    layout: 'left',
    titleSize: 64,
    descSize: 26,
    fontName: 'Outfit',
    gradient: 'void',
    bgImageBuffer: null,
    overlayOpacity: 0.65,
    autoFit: false,
    outputFormat: 'png',
    variables: {
      owner: repo.owner,
      wordmark,
      language: repo.language ?? '',
      stars: repo.stars > 0 ? formatStars(repo.stars) : '',
      repoPath: `github.com/${repo.owner}/${repo.name}`,
      monoFamily: 'JetBrains Mono',
    },
    namedImages: {},
    outputQuality: 90,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/scripts/render-input.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/banners/render-input.ts tests/scripts/render-input.test.ts
git commit -m "feat(banners): build render options from repo descriptor"
```

---

### Task 6: README reference insertion helper

**Files:**
- Create: `scripts/banners/readme-edit.ts`
- Test: `tests/scripts/readme-edit.test.ts`

**Interfaces:**
- Produces: `ensureBannerInReadme(readme: string, repoName: string, bannerPath?: string): { content: string; changed: boolean }`. Default `bannerPath` is `.github/banner.png`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scripts/readme-edit.test.ts
import { describe, expect, it } from 'vitest';
import { ensureBannerInReadme } from '../../scripts/banners/readme-edit';

describe('ensureBannerInReadme', () => {
  it('prepends the banner image line when absent', () => {
    const { content, changed } = ensureBannerInReadme('# FormCraft\n\nText', 'FormCraft');
    expect(changed).toBe(true);
    expect(content.startsWith('![FormCraft banner](.github/banner.png)\n')).toBe(true);
    expect(content).toContain('# FormCraft');
  });

  it('is idempotent when the banner reference already exists', () => {
    const existing = '![FormCraft banner](.github/banner.png)\n\n# FormCraft';
    const { content, changed } = ensureBannerInReadme(existing, 'FormCraft');
    expect(changed).toBe(false);
    expect(content).toBe(existing);
  });

  it('detects an existing reference to the same path regardless of alt text', () => {
    const existing = '![logo](.github/banner.png)\n# X';
    expect(ensureBannerInReadme(existing, 'X').changed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/scripts/readme-edit.test.ts`
Expected: FAIL — cannot resolve `../../scripts/banners/readme-edit`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/banners/readme-edit.ts
export function ensureBannerInReadme(
  readme: string,
  repoName: string,
  bannerPath = '.github/banner.png',
): { content: string; changed: boolean } {
  if (readme.includes(`(${bannerPath})`)) {
    return { content: readme, changed: false };
  }
  const line = `![${repoName} banner](${bannerPath})`;
  const content = `${line}\n\n${readme.replace(/^\n+/, '')}`;
  return { content, changed: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/scripts/readme-edit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/banners/readme-edit.ts tests/scripts/readme-edit.test.ts
git commit -m "feat(banners): insert banner reference into README"
```

---

### Task 7: Contact sheet (QA gallery)

**Files:**
- Create: `scripts/banners/contact-sheet.ts`
- Test: `tests/scripts/contact-sheet.test.ts`

**Interfaces:**
- Produces: `renderContactSheet(items: Array<{ file: string; name: string; owner: string }>): string` — a self-contained HTML string.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scripts/contact-sheet.test.ts
import { describe, expect, it } from 'vitest';
import { renderContactSheet } from '../../scripts/banners/contact-sheet';

describe('renderContactSheet', () => {
  it('emits one img per item and the repo names', () => {
    const html = renderContactSheet([
      { file: 'phmatray__FormCraft.png', name: 'FormCraft', owner: 'phmatray' },
      { file: 'Atypical-Consulting__Koine.png', name: 'Koine', owner: 'Atypical-Consulting' },
    ]);
    expect(html).toContain('<!doctype html>');
    expect((html.match(/<img /g) ?? []).length).toBe(2);
    expect(html).toContain('phmatray__FormCraft.png');
    expect(html).toContain('Koine');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/scripts/contact-sheet.test.ts`
Expected: FAIL — cannot resolve `../../scripts/banners/contact-sheet`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/banners/contact-sheet.ts
export function renderContactSheet(
  items: Array<{ file: string; name: string; owner: string }>,
): string {
  const cards = items
    .map(
      (it) => `<figure>
      <img src="${it.file}" alt="${it.name} banner" loading="lazy" width="640" height="320">
      <figcaption>${it.owner}/<b>${it.name}</b></figcaption>
    </figure>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>README banners — contact sheet (${items.length})</title>
<style>
  body{margin:0;background:#0e1116;color:#e6edf3;font:15px system-ui,sans-serif;padding:24px}
  h1{font-size:18px;margin:0 0 18px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:18px}
  figure{margin:0;background:#161b22;border:1px solid #28303b;border-radius:12px;overflow:hidden}
  img{display:block;width:100%;height:auto}
  figcaption{padding:8px 12px;font-size:13px;color:#8b94a2}
  figcaption b{color:#e6edf3}
</style></head>
<body><h1>${items.length} banners</h1><div class="grid">${cards}</div></body></html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/scripts/contact-sheet.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/banners/contact-sheet.ts tests/scripts/contact-sheet.test.ts
git commit -m "feat(banners): contact-sheet HTML for QA"
```

---

### Task 8: Repo collection via `gh` (I/O)

**Files:**
- Create: `scripts/banners/collect.ts`
- Test: `tests/scripts/collect.test.ts` (pure parsing only)

**Interfaces:**
- Consumes: `RepoDescriptor`, `BannerOverride` from `./render-input`; `extractTagline` from `./tagline`.
- Produces:
  - `parseRepoList(json: string, opts: { skipForks: boolean; skipArchived: boolean }): GhRepo[]`
  - `interface GhRepo { name: string; owner: string; description: string | null; language: string | null; stars: number; isFork: boolean; isArchived: boolean }`
  - `async collectRepos(owner: string, opts: CollectOpts): Promise<RepoDescriptor[]>` where `CollectOpts = { skipForks: boolean; skipArchived: boolean; only?: string[]; limit?: number }`
  - `async run(cmd: string[]): Promise<string>` (thin `Bun.spawn` wrapper around `gh`)

- [ ] **Step 1: Write the failing test (pure parser)**

```ts
// tests/scripts/collect.test.ts
import { describe, expect, it } from 'vitest';
import { parseRepoList } from '../../scripts/banners/collect';

const sample = JSON.stringify([
  { name: 'FormCraft', description: 'x', primaryLanguage: { name: 'C#' }, stargazerCount: 53,
    isFork: false, isArchived: false, owner: { login: 'phmatray' } },
  { name: 'aFork', description: null, primaryLanguage: null, stargazerCount: 0,
    isFork: true, isArchived: false, owner: { login: 'phmatray' } },
  { name: 'oldThing', description: 'y', primaryLanguage: { name: 'Java' }, stargazerCount: 1,
    isFork: false, isArchived: true, owner: { login: 'phmatray' } },
]);

describe('parseRepoList', () => {
  it('normalizes fields and filters forks + archived', () => {
    const repos = parseRepoList(sample, { skipForks: true, skipArchived: true });
    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({ name: 'FormCraft', owner: 'phmatray', language: 'C#', stars: 53 });
  });
  it('keeps everything when filters are off', () => {
    expect(parseRepoList(sample, { skipForks: false, skipArchived: false })).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/scripts/collect.test.ts`
Expected: FAIL — cannot resolve `../../scripts/banners/collect`.

- [ ] **Step 3: Write implementation**

```ts
// scripts/banners/collect.ts
import { extractTagline } from './tagline';
import type { BannerOverride, RepoDescriptor } from './render-input';

export interface GhRepo {
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  isFork: boolean;
  isArchived: boolean;
}

export interface CollectOpts {
  skipForks: boolean;
  skipArchived: boolean;
  only?: string[];
  limit?: number;
}

export async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`${cmd.join(' ')} exited ${code}: ${err.trim()}`);
  }
  return out;
}

export function parseRepoList(
  json: string,
  opts: { skipForks: boolean; skipArchived: boolean },
): GhRepo[] {
  const raw = JSON.parse(json) as Array<Record<string, unknown>>;
  return raw
    .map((r) => ({
      name: String(r.name),
      owner: (r.owner as { login?: string })?.login ?? '',
      description: (r.description as string | null) ?? null,
      language: (r.primaryLanguage as { name?: string } | null)?.name ?? null,
      stars: Number(r.stargazerCount ?? 0),
      isFork: Boolean(r.isFork),
      isArchived: Boolean(r.isArchived),
    }))
    .filter((r) => !(opts.skipForks && r.isFork))
    .filter((r) => !(opts.skipArchived && r.isArchived));
}

async function fetchReadme(owner: string, name: string): Promise<string | null> {
  try {
    return await run(['gh', 'api', `repos/${owner}/${name}/readme`, '-H', 'Accept: application/vnd.github.raw']);
  } catch {
    return null;
  }
}

async function fetchOverride(owner: string, name: string): Promise<BannerOverride | null> {
  try {
    const raw = await run([
      'gh', 'api', `repos/${owner}/${name}/contents/.og/banner.json`,
      '-H', 'Accept: application/vnd.github.raw',
    ]);
    return JSON.parse(raw) as BannerOverride;
  } catch {
    return null;
  }
}

export async function collectRepos(owner: string, opts: CollectOpts): Promise<RepoDescriptor[]> {
  const fields = 'name,description,primaryLanguage,stargazerCount,isFork,isArchived,owner';
  const json = await run(['gh', 'repo', 'list', owner, '--limit', String(opts.limit ?? 500), '--json', fields]);
  let repos = parseRepoList(json, opts);
  if (opts.only?.length) repos = repos.filter((r) => opts.only?.includes(r.name));

  const out: RepoDescriptor[] = [];
  for (const r of repos) {
    const readme = await fetchReadme(r.owner, r.name);
    const override = await fetchOverride(r.owner, r.name);
    out.push({
      owner: r.owner,
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stars,
      tagline: readme ? extractTagline(readme) : null,
      override,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/scripts/collect.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/banners/collect.ts tests/scripts/collect.test.ts
git commit -m "feat(banners): collect repos + tagline + override via gh"
```

---

### Task 9: Commit / PR flow (I/O)

**Files:**
- Create: `scripts/banners/commit.ts`

**Interfaces:**
- Consumes: `run` from `./collect`; `ensureBannerInReadme` from `./readme-edit`.
- Produces: `async commitBanner(args: { owner: string; name: string; pngPath: string; workdir: string; dryRun: boolean }): Promise<{ repo: string; action: 'pr-opened' | 'skipped' | 'dry-run' }>`.

- [ ] **Step 1: Write implementation** (I/O flow — verified by dry-run in Task 10, not a unit test)

```ts
// scripts/banners/commit.ts
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './collect';
import { ensureBannerInReadme } from './readme-edit';

export async function commitBanner(args: {
  owner: string;
  name: string;
  pngPath: string;
  workdir: string;
  dryRun: boolean;
}): Promise<{ repo: string; action: 'pr-opened' | 'skipped' | 'dry-run' }> {
  const { owner, name, pngPath, workdir, dryRun } = args;
  const repo = `${owner}/${name}`;
  const dir = join(workdir, name);

  if (dryRun) {
    console.log(`[dry-run] would open PR on ${repo} with .github/banner.png`);
    return { repo, action: 'dry-run' };
  }

  await run(['gh', 'repo', 'clone', repo, dir, '--', '--depth', '1']);
  await mkdir(join(dir, '.github'), { recursive: true });
  await copyFile(pngPath, join(dir, '.github', 'banner.png'));

  const readmePath = join(dir, 'README.md');
  let readme = '';
  try {
    readme = await readFile(readmePath, 'utf8');
  } catch {
    readme = `# ${name}\n`;
  }
  const { content, changed } = ensureBannerInReadme(readme, name);
  if (changed) await writeFile(readmePath, content);

  await run(['git', '-C', dir, 'checkout', '-b', 'chore/readme-banner']);
  await run(['git', '-C', dir, 'add', '.github/banner.png', 'README.md']);
  await run(['git', '-C', dir, 'commit', '-m', 'chore: add branded README banner']);
  await run(['git', '-C', dir, 'push', '-u', 'origin', 'chore/readme-banner']);
  await run([
    'gh', 'pr', 'create', '-R', repo, '--head', 'chore/readme-banner',
    '--title', 'chore: add branded README banner',
    '--body', 'Adds `.github/banner.png` (generated by og-engine) and references it at the top of the README.',
  ]);

  return { repo, action: 'pr-opened' };
}
```

- [ ] **Step 2: Type-check**

Run: `bun run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/banners/commit.ts
git commit -m "feat(banners): commit banner + open PR per repo"
```

---

### Task 10: CLI entrypoint (phases A–D)

**Files:**
- Create: `scripts/generate-readme-banners.ts`
- Modify: `package.json` (add a `banners` script)

**Interfaces:**
- Consumes: `collectRepos` (Task 8), `buildBannerRenderOptions` (Task 5), `renderCard` (engine), `registerFonts` (engine), `renderContactSheet` (Task 7), `commitBanner` (Task 9).

- [ ] **Step 1: Write the CLI**

```ts
// scripts/generate-readme-banners.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registerFonts } from '../src/engine/fonts';
import { renderCard } from '../src/engine/renderer';
import { collectRepos } from './banners/collect';
import { commitBanner } from './banners/commit';
import { renderContactSheet } from './banners/contact-sheet';
import { buildBannerRenderOptions } from './banners/render-input';

interface Flags {
  account: string;
  only?: string[];
  skipForks: boolean;
  skipArchived: boolean;
  dryRun: boolean;
  commit: boolean;
  limit?: number;
}

function parseFlags(argv: string[]): Flags {
  const get = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (k: string): boolean => argv.includes(`--${k}`);
  return {
    account: get('account') ?? 'all',
    only: get('only')?.split(','),
    skipForks: !has('include-forks'),
    skipArchived: !has('include-archived'),
    dryRun: has('dry-run'),
    commit: has('commit'),
    limit: get('limit') ? Number(get('limit')) : undefined,
  };
}

const ACCOUNTS = ['phmatray', 'Atypical-Consulting'];

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const owners = flags.account === 'all' ? ACCOUNTS : [flags.account];
  const outDir = join(process.cwd(), 'out', 'banners');
  await mkdir(outDir, { recursive: true });
  await registerFonts(join(process.cwd(), 'fonts'));

  // Phase A — collect
  const repos = (
    await Promise.all(
      owners.map((o) =>
        collectRepos(o, {
          skipForks: flags.skipForks,
          skipArchived: flags.skipArchived,
          only: flags.only,
          limit: flags.limit,
        }),
      ),
    )
  ).flat();
  console.log(`Collected ${repos.length} repos across ${owners.length} account(s).`);

  // Phase B — render
  const sheet: Array<{ file: string; name: string; owner: string }> = [];
  for (const repo of repos) {
    const res = await renderCard(buildBannerRenderOptions(repo));
    const file = `${repo.owner}__${repo.name}.png`;
    await writeFile(join(outDir, file), res.buffer);
    sheet.push({ file, name: repo.name, owner: repo.owner });
    if (res.overflow) console.warn(`  overflow: ${repo.owner}/${repo.name}`);
  }
  console.log(`Rendered ${sheet.length} banners to ${outDir}`);

  // Phase C — contact sheet
  await writeFile(join(outDir, 'index.html'), renderContactSheet(sheet));
  console.log(`Contact sheet: ${join(outDir, 'index.html')}`);

  // Phase D — commit (opt-in)
  if (flags.commit || flags.dryRun) {
    const workdir = join(process.cwd(), 'out', 'clones');
    await mkdir(workdir, { recursive: true });
    for (const repo of repos) {
      const png = join(outDir, `${repo.owner}__${repo.name}.png`);
      const r = await commitBanner({
        owner: repo.owner, name: repo.name, pngPath: png, workdir, dryRun: flags.dryRun,
      });
      console.log(`  ${r.action}: ${r.repo}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the package.json script**

In `package.json` `scripts`, add:
```json
    "banners": "bun run scripts/generate-readme-banners.ts",
```

- [ ] **Step 3: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: no errors, no warnings that fail the check.

- [ ] **Step 4: Smoke test — render one repo (no commit)**

Run: `bun run banners --account phmatray --only FormCraft`
Expected: prints `Collected 1 repos`, `Rendered 1 banners`, writes `out/banners/phmatray__FormCraft.png` and `out/banners/index.html`. Open the PNG and the contact sheet to visually verify the design.

- [ ] **Step 5: Dry-run the commit phase**

Run: `bun run banners --account phmatray --only FormCraft --dry-run`
Expected: additionally prints `[dry-run] would open PR on phmatray/FormCraft with .github/banner.png`; no clone/push happens.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-readme-banners.ts package.json
git commit -m "feat(banners): CLI to render + (opt-in) commit README banners"
```

---

### Task 11: Full-portfolio dry run + docs

**Files:**
- Modify: `README.md` (document the `banners` script under a new subsection)
- Add: `.gitignore` entry for `out/`

- [ ] **Step 1: Ignore generated output**

Append to `.gitignore`:
```
out/
```

- [ ] **Step 2: Generate the whole portfolio to the contact sheet (no commit)**

Run: `bun run banners`
Expected: collects ~300+ repos, renders all banners to `out/banners/`, writes `out/banners/index.html`. Review the contact sheet; note any repos flagged `overflow:` for tagline/name tuning or a `.og/banner.json` override.

- [ ] **Step 3: Document the script in README**

Add under a new `### README banners` subsection of the README (near "Integration Examples"):
```markdown
### README banners

Generate a branded 1280×640 banner for every repo and (optionally) open a PR that
commits `.github/banner.png` + a README reference:

    bun run fonts:download            # once
    bun run banners                   # render all -> out/banners/ + contact sheet
    bun run banners --only FormCraft --dry-run
    bun run banners --account Atypical-Consulting --commit

Per-repo overrides: add `.og/banner.json` `{ "tagline", "accent", "emoji", "wordmark" }`.
```

- [ ] **Step 4: Full test suite**

Run: `bun run test`
Expected: all suites pass (existing + the 7 new test files).

- [ ] **Step 5: Commit**

```bash
git add README.md .gitignore
git commit -m "docs: document the README banner generator"
```

---

## Self-Review

**Spec coverage:**
- Banner anatomy / per-owner wordmark / accent=language → Tasks 1, 3, 5. ✅
- 1280×640 format (`readme`) → Task 2. ✅
- Hybrid content (metadata + README first line + `.og/banner.json` override) → Tasks 4, 5, 8. ✅
- In-process `renderCard`, no HTTP → Task 10. ✅
- Phases collect/render/contact-sheet/commit → Tasks 8, 10, 7, 9. ✅
- `.github/banner.png` + README reference insertion → Tasks 6, 9. ✅
- Diamond mark, no external SVG → Task 3. ✅
- Tests (language-colors, readme-banner, tagline, render-input) → Tasks 1, 3, 4, 5 (+ readme-edit, contact-sheet, collect parser). ✅
- Rollout by waves → operational (use `--only` / `--commit`), documented in Task 11. ✅
- Out of scope (GitHub Action, live URL, slim variant, description rewrite) → not implemented, as intended. ✅

**Placeholder scan:** No TBD/TODO; every code step contains full code; every command has an expected result.

**Type consistency:** `RepoDescriptor`/`BannerOverride` defined in Task 5 and reused in Tasks 8–9; `buildBannerRenderOptions`, `collectRepos`, `commitBanner`, `renderContactSheet`, `ensureBannerInReadme`, `parseRepoList`, `run`, `extractTagline`, `languageColor` names are consistent across producer/consumer blocks. `RenderOptions`/`renderCard` match the engine's real signature (verified in source).
