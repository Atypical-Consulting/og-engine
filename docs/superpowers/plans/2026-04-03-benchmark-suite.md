# Benchmark Suite & Documentation Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible benchmark suite with phase-level timing, real Puppeteer comparison, and update all documentation to match measured reality.

**Architecture:** Instrument the renderer with optional phase timing. Build a benchmark runner that exercises multiple scenarios, runs a real Puppeteer baseline for comparison, and generates both machine-readable JSON and human-readable markdown reports. Then sweep all docs to replace fabricated numbers with measured ones.

**Tech Stack:** Bun, @napi-rs/canvas, Puppeteer, Vitest

---

## File Structure

```
benchmarks/
├── scenarios.ts              # Scenario definitions (shared by both runners)
├── stats.ts                  # Statistical helpers (percentiles, stddev)
├── machine-info.ts           # Captures OS, CPU, RAM, versions
├── run.ts                    # OG Engine benchmark runner
├── puppeteer-baseline.ts     # Puppeteer comparison runner
├── report.ts                 # Markdown + JSON report generator
├── run-full.ts               # Orchestrator: runs both, generates report
├── results/
│   └── .gitkeep
└── README.md                 # How to run, methodology
```

**Modified files:**
- `src/engine/renderer.ts` — add `timing` option + `RenderPhases`
- `package.json` — add puppeteer dev dep, add `bench:full` script
- `.gitignore` — add `benchmarks/results/*.json`
- `tests/engine/renderer.test.ts` — add test for timing flag

**Doc files to update (Task 10):**
- `CLAUDE.md`
- `docs/site/src/content/docs/index.mdx`
- `docs/site/src/content/docs/quick-start.mdx`
- `docs/site/src/content/docs/compare/puppeteer.mdx`
- `docs/site/src/content/docs/blog/why-we-built-og-engine.mdx`
- `docs/site/src/content/docs/blog/how-pretext-measures-text.mdx`
- `docs/site/src/content/docs/api-reference/render.mdx`
- `docs/site/astro.config.mjs`
- `docs/analysis/GO-TO-MARKET.md`

**New doc file (Task 11):**
- `docs/site/src/content/docs/benchmarks.mdx`

---

## Task 1: Renderer Phase Instrumentation

**Files:**
- Modify: `src/engine/renderer.ts`
- Modify: `tests/engine/renderer.test.ts`

- [ ] **Step 1: Write the failing test for timing flag**

Add to the bottom of `tests/engine/renderer.test.ts`:

```typescript
describe('renderCard with timing', () => {
  it('returns phases when timing is true', () => {
    const result = renderCard({
      ...defaultOptions(),
      timing: true,
    });
    expect(result.phases).toBeDefined();
    expect(result.phases!.textMeasureMs).toBeGreaterThanOrEqual(0);
    expect(result.phases!.canvasDrawMs).toBeGreaterThanOrEqual(0);
    expect(result.phases!.pngEncodeMs).toBeGreaterThanOrEqual(0);
    expect(result.phases!.totalMs).toBeGreaterThanOrEqual(0);
    // totalMs should be approximately the sum of phases
    const sum = result.phases!.textMeasureMs + result.phases!.canvasDrawMs + result.phases!.pngEncodeMs;
    expect(Math.abs(result.phases!.totalMs - sum)).toBeLessThan(1);
  });

  it('does not return phases when timing is false or omitted', () => {
    const result = renderCard(defaultOptions());
    expect(result.phases).toBeUndefined();
  });
});
```

Note: `defaultOptions()` is already defined in this test file. If `timing` is not yet on the type, the test will fail at compilation.

- [ ] **Step 2: Run the test to verify it fails**

```bash
bunx vitest run tests/engine/renderer.test.ts
```

Expected: FAIL — `timing` property does not exist on `RenderOptions`.

- [ ] **Step 3: Update RenderOptions and RenderResult types in renderer.ts**

In `src/engine/renderer.ts`, add `timing` to `RenderOptions` and `RenderPhases` + `phases` to `RenderResult`. Replace the existing interfaces:

```typescript
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
  timing?: boolean;
}

export interface RenderPhases {
  textMeasureMs: number;
  canvasDrawMs: number;
  pngEncodeMs: number;
  totalMs: number;
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
  phases?: RenderPhases;
}
```

- [ ] **Step 4: Add phase timing to renderCard function body**

In the `renderCard` function, add `timing` to the destructured options:

```typescript
const {
  title, description, author, tag, format, accent, layout,
  titleSize, descSize, fontName, gradient: gradientSlug,
  bgImageBuffer, overlayOpacity, timing,
} = options;
```

Add timing markers. After the format validation and canvas creation block (after `const ff = fontEntry.family;`), add:

```typescript
  const t = timing ? { t0: performance.now(), t1: 0, t2: 0, t3: 0 } : null;
```

After the description measurement block (after `const visibleD = dLines.slice(0, maxD);`), add:

```typescript
  if (t) t.t1 = performance.now();
```

Before the `canvas.toBuffer('image/png')` call at the bottom (after the frame stroke block), add:

```typescript
  if (t) t.t2 = performance.now();
```

Replace the return statement. Change:

```typescript
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
```

To:

```typescript
  const buffer = canvas.toBuffer('image/png');

  let phases: RenderPhases | undefined;
  if (t) {
    t.t3 = performance.now();
    phases = {
      textMeasureMs: Number((t.t1 - t.t0).toFixed(3)),
      canvasDrawMs: Number((t.t2 - t.t1).toFixed(3)),
      pngEncodeMs: Number((t.t3 - t.t2).toFixed(3)),
      totalMs: Number((t.t3 - t.t0).toFixed(3)),
    };
  }

  return {
    buffer,
    width: W,
    height: H,
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
    phases,
  };
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
bunx vitest run tests/engine/renderer.test.ts
```

Expected: PASS — all existing tests + 2 new timing tests.

- [ ] **Step 6: Commit**

```bash
git add src/engine/renderer.ts tests/engine/renderer.test.ts
git commit -m "feat(engine): add optional phase timing to renderCard"
```

---

## Task 2: Install Puppeteer + Update Scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install puppeteer as dev dependency**

```bash
bun add -d puppeteer
```

- [ ] **Step 2: Add bench:full script to package.json**

Add to the `"scripts"` section in `package.json`:

```json
"bench:full": "bun run benchmarks/run-full.ts"
```

- [ ] **Step 3: Add benchmark raw data to .gitignore**

Append to `.gitignore`:

```gitignore

# Benchmark raw data (large JSON files)
benchmarks/results/*.json
```

- [ ] **Step 4: Create results directory**

```bash
mkdir -p benchmarks/results
touch benchmarks/results/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock .gitignore benchmarks/results/.gitkeep
git commit -m "chore: add puppeteer dev dep, bench:full script, benchmark results dir"
```

---

## Task 3: Benchmark Scenarios + Stats Helpers

**Files:**
- Create: `benchmarks/scenarios.ts`
- Create: `benchmarks/stats.ts`
- Create: `benchmarks/machine-info.ts`

- [ ] **Step 1: Create benchmarks/scenarios.ts**

```typescript
// benchmarks/scenarios.ts
import type { RenderOptions } from '../src/engine/renderer';

export interface Scenario {
  name: string;
  slug: string;
  options: RenderOptions;
}

const base: Omit<RenderOptions, 'title' | 'description' | 'format' | 'fontName'> = {
  author: 'OG Engine',
  tag: 'Benchmark',
  accent: '#38ef7d',
  layout: 'left',
  titleSize: 48,
  descSize: 22,
  gradient: 'void',
  bgImageBuffer: null,
  overlayOpacity: 0.65,
  timing: true,
};

export const SCENARIOS: Scenario[] = [
  {
    name: 'Baseline (og, 1 line, Outfit)',
    slug: 'baseline',
    options: {
      ...base,
      title: 'Hello, OG Engine',
      description: 'Generated without a browser.',
      format: 'og',
      fontName: 'Outfit',
    },
  },
  {
    name: 'Long text (og, overflow, Outfit)',
    slug: 'long-text',
    options: {
      ...base,
      title: 'Server-Side Text Layout Without a Browser Engine — How Pretext Measures Every Glyph to Compute Perfect Line Breaks in Under One Millisecond',
      description: 'Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content. No DOM, no CSSOM, no paint cycle.',
      format: 'og',
      fontName: 'Outfit',
    },
  },
  {
    name: 'Story format (1080x1920, Outfit)',
    slug: 'story',
    options: {
      ...base,
      title: 'Server-Side Text Layout Without a Browser Engine — How Pretext Measures Every Glyph to Compute Perfect Line Breaks in Under One Millisecond',
      description: 'Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content. No DOM, no CSSOM, no paint cycle.',
      format: 'story',
      fontName: 'Outfit',
    },
  },
  {
    name: 'CJK (og, Noto Sans JP)',
    slug: 'cjk',
    options: {
      ...base,
      title: 'ブラウザなしのサーバーサイドテキストレイアウト — Pretextがすべてのグリフを測定',
      description: '純粋なJavaScriptテキスト測定がPuppeteerとヘッドレスChromeを置き換えます。OG画像の1ミリ秒未満のレイアウト。',
      format: 'og',
      fontName: 'Noto Sans JP',
    },
  },
];

// HTML template for Puppeteer baseline — visually equivalent to OG Engine default template
export function puppeteerHtml(title: string, description: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: linear-gradient(to bottom right, #0c0f1a, #080a12);
    font-family: 'Outfit', sans-serif;
    color: #f1f5f9;
    display: flex; flex-direction: column; justify-content: center;
    padding: 64px;
  }
  .tag {
    display: inline-block; background: rgba(56,239,125,0.1);
    color: #38ef7d; font-size: 14px; font-weight: 600;
    padding: 4px 12px; border-radius: 14px; text-transform: uppercase;
    margin-bottom: 16px;
  }
  h1 { font-size: 48px; font-weight: 800; line-height: 1.2; margin-bottom: 20px; }
  p { font-size: 22px; color: #94a3b8; line-height: 1.55; }
  .author { color: #38ef7d; font-size: 18px; font-weight: 700; margin-top: 28px; }
</style>
</head>
<body>
  <span class="tag">BENCHMARK</span>
  <h1>${title}</h1>
  <p>${description}</p>
  <div class="author">OG Engine</div>
</body>
</html>`;
}
```

- [ ] **Step 2: Create benchmarks/stats.ts**

```typescript
// benchmarks/stats.ts
export interface Stats {
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
  stddev: number;
  count: number;
}

export function computeStats(times: number[]): Stats {
  if (times.length === 0) {
    return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0, stddev: 0, count: 0 };
  }

  const sorted = [...times].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / count;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count;

  return {
    min: sorted[0],
    p50: sorted[Math.floor(count * 0.5)],
    p95: sorted[Math.floor(count * 0.95)],
    p99: sorted[Math.floor(count * 0.99)],
    max: sorted[count - 1],
    mean,
    stddev: Math.sqrt(variance),
    count,
  };
}

export function formatMs(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`;
}
```

- [ ] **Step 3: Create benchmarks/machine-info.ts**

```typescript
// benchmarks/machine-info.ts
import { execSync } from 'child_process';
import os from 'os';

export interface MachineInfo {
  os: string;
  cpu: string;
  cores: number;
  ram: string;
  bunVersion: string;
  nodeVersion: string;
  canvasVersion: string;
  puppeteerVersion: string;
  timestamp: string;
}

function getPackageVersion(pkg: string): string {
  try {
    const json = require(`${pkg}/package.json`);
    return json.version ?? 'unknown';
  } catch {
    try {
      const result = execSync(`bun pm ls 2>/dev/null | grep ${pkg}`, { encoding: 'utf-8' });
      const match = result.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

export function getMachineInfo(): MachineInfo {
  const ramGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(0);
  let bunVersion = 'unknown';
  try {
    bunVersion = execSync('bun --version', { encoding: 'utf-8' }).trim();
  } catch {}

  let nodeVersion = 'unknown';
  try {
    nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
  } catch {}

  return {
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cores: os.cpus().length,
    ram: `${ramGB} GB`,
    bunVersion,
    nodeVersion,
    canvasVersion: getPackageVersion('@napi-rs/canvas'),
    puppeteerVersion: getPackageVersion('puppeteer'),
    timestamp: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add benchmarks/scenarios.ts benchmarks/stats.ts benchmarks/machine-info.ts
git commit -m "feat(bench): add scenario definitions, stats helpers, machine info"
```

---

## Task 4: OG Engine Benchmark Runner

**Files:**
- Create: `benchmarks/run.ts`

- [ ] **Step 1: Create benchmarks/run.ts**

```typescript
// benchmarks/run.ts
import { registerFonts } from '../src/engine/fonts';
import { renderCard } from '../src/engine/renderer';
import { SCENARIOS, type Scenario } from './scenarios';
import { computeStats, formatMs, type Stats } from './stats';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'fonts');

const WARMUP = 50;
const ITERATIONS = 1000;

export interface PhaseResults {
  textMeasure: number[];
  canvasDraw: number[];
  pngEncode: number[];
  fullPipeline: number[];
}

export interface ScenarioResult {
  scenario: Scenario;
  raw: PhaseResults;
  stats: {
    textMeasure: Stats;
    canvasDraw: Stats;
    pngEncode: Stats;
    fullPipeline: Stats;
  };
}

function runScenario(scenario: Scenario): ScenarioResult {
  const opts = { ...scenario.options, timing: true };

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    renderCard(opts);
  }

  const raw: PhaseResults = {
    textMeasure: [],
    canvasDraw: [],
    pngEncode: [],
    fullPipeline: [],
  };

  for (let i = 0; i < ITERATIONS; i++) {
    const result = renderCard(opts);
    const p = result.phases!;
    raw.textMeasure.push(p.textMeasureMs);
    raw.canvasDraw.push(p.canvasDrawMs);
    raw.pngEncode.push(p.pngEncodeMs);
    raw.fullPipeline.push(p.totalMs);
  }

  return {
    scenario,
    raw,
    stats: {
      textMeasure: computeStats(raw.textMeasure),
      canvasDraw: computeStats(raw.canvasDraw),
      pngEncode: computeStats(raw.pngEncode),
      fullPipeline: computeStats(raw.fullPipeline),
    },
  };
}

export async function runOgBenchmarks(): Promise<ScenarioResult[]> {
  await registerFonts(FONTS_DIR);

  const results: ScenarioResult[] = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  ${scenario.name}...`);
    const result = runScenario(scenario);
    const p50 = result.stats.fullPipeline.p50;
    console.log(` ${formatMs(p50)} (P50)`);
    results.push(result);
  }

  return results;
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`\nOG Engine Benchmark (${ITERATIONS} iterations, ${WARMUP} warmup)\n`);
  const results = await runOgBenchmarks();

  console.log('\n--- Detailed Results ---\n');
  for (const r of results) {
    console.log(`${r.scenario.name}`);
    console.log(`  Text measure:  ${formatMs(r.stats.textMeasure.p50)} (P50)  ${formatMs(r.stats.textMeasure.p95)} (P95)`);
    console.log(`  Canvas draw:   ${formatMs(r.stats.canvasDraw.p50)} (P50)  ${formatMs(r.stats.canvasDraw.p95)} (P95)`);
    console.log(`  PNG encode:    ${formatMs(r.stats.pngEncode.p50)} (P50)  ${formatMs(r.stats.pngEncode.p95)} (P95)`);
    console.log(`  Full pipeline: ${formatMs(r.stats.fullPipeline.p50)} (P50)  ${formatMs(r.stats.fullPipeline.p95)} (P95)`);
    console.log('');
  }
}
```

- [ ] **Step 2: Run the OG Engine benchmark standalone**

```bash
bun run benchmarks/run.ts
```

Expected: All 4 scenarios run, each showing P50 and P95 for all phases. Full pipeline P50 should be in the 20-25ms range.

- [ ] **Step 3: Commit**

```bash
git add benchmarks/run.ts
git commit -m "feat(bench): add OG Engine benchmark runner with phase timing"
```

---

## Task 5: Puppeteer Baseline Runner

**Files:**
- Create: `benchmarks/puppeteer-baseline.ts`

- [ ] **Step 1: Create benchmarks/puppeteer-baseline.ts**

```typescript
// benchmarks/puppeteer-baseline.ts
import puppeteer, { type Browser } from 'puppeteer';
import { SCENARIOS, puppeteerHtml } from './scenarios';
import { computeStats, formatMs, type Stats } from './stats';

const WARMUP = 5;
const ITERATIONS = 50; // Puppeteer is slow — 50 is enough for stable P50

export interface PuppeteerResult {
  scenarioSlug: string;
  scenarioName: string;
  warm: { raw: number[]; stats: Stats };
  cold: { raw: number[]; stats: Stats };
}

async function runWarm(browser: Browser, html: string, iterations: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ type: 'png' });
    await page.close();
    times.push(performance.now() - t0);
  }
  return times;
}

async function runCold(html: string, iterations: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ type: 'png' });
    await page.close();
    await browser.close();
    times.push(performance.now() - t0);
  }
  return times;
}

export async function runPuppeteerBaseline(): Promise<PuppeteerResult[]> {
  const results: PuppeteerResult[] = [];

  // Only run baseline and long-text scenarios for Puppeteer (representative)
  const scenarios = SCENARIOS.filter((s) => s.slug === 'baseline' || s.slug === 'long-text');

  for (const scenario of scenarios) {
    const html = puppeteerHtml(scenario.options.title, scenario.options.description);

    // Warm: reuse browser
    process.stdout.write(`  ${scenario.name} (warm)...`);
    const browser = await puppeteer.launch({ headless: true });

    // Warmup
    for (let i = 0; i < WARMUP; i++) {
      const p = await browser.newPage();
      await p.setViewport({ width: 1200, height: 630 });
      await p.setContent(html, { waitUntil: 'load' });
      await p.screenshot({ type: 'png' });
      await p.close();
    }

    const warmTimes = await runWarm(browser, html, ITERATIONS);
    await browser.close();
    console.log(` ${formatMs(computeStats(warmTimes).p50)} (P50)`);

    // Cold: fresh browser each time (only 10 iterations — very slow)
    process.stdout.write(`  ${scenario.name} (cold)...`);
    const coldTimes = await runCold(html, 10);
    console.log(` ${formatMs(computeStats(coldTimes).p50)} (P50)`);

    results.push({
      scenarioSlug: scenario.slug,
      scenarioName: scenario.name,
      warm: { raw: warmTimes, stats: computeStats(warmTimes) },
      cold: { raw: coldTimes, stats: computeStats(coldTimes) },
    });
  }

  return results;
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\nPuppeteer Baseline Benchmark\n');
  const results = await runPuppeteerBaseline();

  console.log('\n--- Results ---\n');
  for (const r of results) {
    console.log(`${r.scenarioName}`);
    console.log(`  Warm: ${formatMs(r.warm.stats.p50)} (P50)  ${formatMs(r.warm.stats.p95)} (P95)`);
    console.log(`  Cold: ${formatMs(r.cold.stats.p50)} (P50)  ${formatMs(r.cold.stats.p95)} (P95)`);
    console.log('');
  }
}
```

- [ ] **Step 2: Run Puppeteer baseline standalone**

```bash
bun run benchmarks/puppeteer-baseline.ts
```

Expected: 2 scenarios, warm and cold. Warm P50 should be in the 200-1000ms range. Cold P50 should be 1-3 seconds. This will take a few minutes.

- [ ] **Step 3: Commit**

```bash
git add benchmarks/puppeteer-baseline.ts
git commit -m "feat(bench): add Puppeteer baseline runner for comparison"
```

---

## Task 6: Report Generator

**Files:**
- Create: `benchmarks/report.ts`

- [ ] **Step 1: Create benchmarks/report.ts**

```typescript
// benchmarks/report.ts
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ScenarioResult } from './run';
import type { PuppeteerResult } from './puppeteer-baseline';
import type { MachineInfo } from './machine-info';
import { formatMs } from './stats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function writeJsonReport(
  machine: MachineInfo,
  ogResults: ScenarioResult[],
  puppeteerResults: PuppeteerResult[],
): Promise<string> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const data = {
    machine,
    methodology: {
      ogEngine: { iterations: 1000, warmup: 50 },
      puppeteer: { warmIterations: 50, coldIterations: 10, warmup: 5 },
    },
    scenarios: Object.fromEntries(
      ogResults.map((r) => [
        r.scenario.slug,
        {
          ogEngine: {
            phases: {
              textMeasure: r.raw.textMeasure,
              canvasDraw: r.raw.canvasDraw,
              pngEncode: r.raw.pngEncode,
            },
            fullPipeline: r.raw.fullPipeline,
          },
          puppeteer: puppeteerResults.find((p) => p.scenarioSlug === r.scenario.slug) ?? null,
        },
      ]),
    ),
  };

  const path = join(RESULTS_DIR, `${today()}-raw.json`);
  await writeFile(path, JSON.stringify(data, null, 2));
  return path;
}

export async function writeMarkdownReport(
  machine: MachineInfo,
  ogResults: ScenarioResult[],
  puppeteerResults: PuppeteerResult[],
): Promise<string> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const lines: string[] = [];
  lines.push(`# OG Engine Benchmark Report — ${today()}`);
  lines.push('');
  lines.push('## Machine');
  lines.push('');
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| **OS** | ${machine.os} |`);
  lines.push(`| **CPU** | ${machine.cpu} |`);
  lines.push(`| **Cores** | ${machine.cores} |`);
  lines.push(`| **RAM** | ${machine.ram} |`);
  lines.push(`| **Bun** | ${machine.bunVersion} |`);
  lines.push(`| **Node.js** | ${machine.nodeVersion} |`);
  lines.push(`| **@napi-rs/canvas** | ${machine.canvasVersion} |`);
  lines.push(`| **Puppeteer** | ${machine.puppeteerVersion} |`);
  lines.push('');
  lines.push('## Methodology');
  lines.push('');
  lines.push('- OG Engine: 1000 iterations per scenario, 50 warmup (discarded)');
  lines.push('- Puppeteer warm: 50 iterations, browser reused, 5 warmup');
  lines.push('- Puppeteer cold: 10 iterations, fresh browser per render');
  lines.push('- All times in milliseconds');
  lines.push('');

  // OG Engine results
  lines.push('## OG Engine Results');
  lines.push('');
  lines.push('| Scenario | Text Measure (P50) | Canvas Draw (P50) | PNG Encode (P50) | Full Pipeline (P50) | Full Pipeline (P95) |');
  lines.push('|---|---|---|---|---|---|');

  for (const r of ogResults) {
    lines.push(
      `| ${r.scenario.name} | ${formatMs(r.stats.textMeasure.p50)} | ${formatMs(r.stats.canvasDraw.p50)} | ${formatMs(r.stats.pngEncode.p50)} | **${formatMs(r.stats.fullPipeline.p50)}** | ${formatMs(r.stats.fullPipeline.p95)} |`,
    );
  }

  lines.push('');

  // Puppeteer results
  if (puppeteerResults.length > 0) {
    lines.push('## Puppeteer Baseline');
    lines.push('');
    lines.push('| Scenario | Warm P50 | Warm P95 | Cold P50 | Cold P95 |');
    lines.push('|---|---|---|---|---|');

    for (const r of puppeteerResults) {
      lines.push(
        `| ${r.scenarioName} | **${formatMs(r.warm.stats.p50)}** | ${formatMs(r.warm.stats.p95)} | ${formatMs(r.cold.stats.p50)} | ${formatMs(r.cold.stats.p95)} |`,
      );
    }

    lines.push('');

    // Speedup comparison
    lines.push('## Speedup Comparison');
    lines.push('');
    lines.push('| Scenario | OG Engine (P50) | Puppeteer Warm (P50) | Speedup |');
    lines.push('|---|---|---|---|');

    for (const pr of puppeteerResults) {
      const ogr = ogResults.find((o) => o.scenario.slug === pr.scenarioSlug);
      if (ogr) {
        const speedup = (pr.warm.stats.p50 / ogr.stats.fullPipeline.p50).toFixed(0);
        lines.push(
          `| ${pr.scenarioName} | **${formatMs(ogr.stats.fullPipeline.p50)}** | ${formatMs(pr.warm.stats.p50)} | **${speedup}x** |`,
        );
      }
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*Generated by `bun run bench:full`. See `benchmarks/README.md` for methodology.*');

  const path = join(RESULTS_DIR, `${today()}-report.md`);
  await writeFile(path, lines.join('\n'));
  return path;
}
```

- [ ] **Step 2: Commit**

```bash
git add benchmarks/report.ts
git commit -m "feat(bench): add markdown + JSON report generator"
```

---

## Task 7: Full Benchmark Orchestrator

**Files:**
- Create: `benchmarks/run-full.ts`

- [ ] **Step 1: Create benchmarks/run-full.ts**

```typescript
// benchmarks/run-full.ts
import { runOgBenchmarks } from './run';
import { runPuppeteerBaseline } from './puppeteer-baseline';
import { writeJsonReport, writeMarkdownReport } from './report';
import { getMachineInfo } from './machine-info';

console.log('╔══════════════════════════════════════╗');
console.log('║   OG Engine Benchmark Suite          ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

const machine = getMachineInfo();
console.log(`Machine: ${machine.os} / ${machine.cpu} / ${machine.ram}`);
console.log(`Bun: ${machine.bunVersion} | Node: ${machine.nodeVersion}`);
console.log('');

// Phase 1: OG Engine
console.log('── OG Engine ──');
const ogResults = await runOgBenchmarks();
console.log('');

// Phase 2: Puppeteer
console.log('── Puppeteer Baseline ──');
const puppeteerResults = await runPuppeteerBaseline();
console.log('');

// Phase 3: Reports
console.log('── Generating Reports ──');
const jsonPath = await writeJsonReport(machine, ogResults, puppeteerResults);
const mdPath = await writeMarkdownReport(machine, ogResults, puppeteerResults);
console.log(`  JSON: ${jsonPath}`);
console.log(`  Markdown: ${mdPath}`);
console.log('');

// Summary
const baselineOg = ogResults.find((r) => r.scenario.slug === 'baseline');
const baselinePp = puppeteerResults.find((r) => r.scenarioSlug === 'baseline');
if (baselineOg && baselinePp) {
  const ogP50 = baselineOg.stats.fullPipeline.p50;
  const ppP50 = baselinePp.warm.stats.p50;
  const speedup = (ppP50 / ogP50).toFixed(0);
  console.log('── Summary ──');
  console.log(`  OG Engine:  ${ogP50.toFixed(2)}ms (P50 full pipeline)`);
  console.log(`  Puppeteer:  ${ppP50.toFixed(2)}ms (P50 warm)`);
  console.log(`  Speedup:    ${speedup}x`);
  console.log('');
  console.log(`  Text layout: ${baselineOg.stats.textMeasure.p50.toFixed(2)}ms`);
  console.log(`  Canvas draw: ${baselineOg.stats.canvasDraw.p50.toFixed(2)}ms`);
  console.log(`  PNG encode:  ${baselineOg.stats.pngEncode.p50.toFixed(2)}ms`);
}

console.log('\nDone.');
```

- [ ] **Step 2: Run the full benchmark suite**

```bash
bun run bench:full
```

Expected: Full output with OG Engine scenarios, Puppeteer baselines, generated report files. Takes 3-5 minutes due to Puppeteer runs.

- [ ] **Step 3: Commit the report (not the raw JSON)**

```bash
git add benchmarks/run-full.ts benchmarks/results/*-report.md
git commit -m "feat(bench): add full benchmark orchestrator, save first report"
```

---

## Task 8: Benchmark README

**Files:**
- Create: `benchmarks/README.md`

- [ ] **Step 1: Create benchmarks/README.md**

```markdown
# OG Engine Benchmarks

Reproducible performance benchmarks comparing OG Engine against Puppeteer.

## Quick Start

```bash
# Download fonts first (if not already done)
bun run fonts:download

# Run the full benchmark suite
bun run bench:full
```

## What It Measures

### OG Engine — Phase Breakdown

Each render is broken into three phases:

| Phase | What it does |
|-------|-------------|
| **Text measurement** | `measureLines()` — word-wrap computation |
| **Canvas draw** | Gradient, grid, glow, text, decorations |
| **PNG encode** | `canvas.toBuffer('image/png')` |
| **Full pipeline** | All three combined (= real API response time) |

### Puppeteer Baseline

Same content rendered via headless Chrome for apples-to-apples comparison:

- **Warm:** Browser reused between renders (best case for Puppeteer)
- **Cold:** Fresh browser launch per render (realistic for serverless)

## Methodology

- **OG Engine:** 1000 iterations per scenario, 50 warmup (discarded)
- **Puppeteer warm:** 50 iterations, browser reused, 5 warmup
- **Puppeteer cold:** 10 iterations, fresh browser per render
- All times measured with `performance.now()`
- Machine info captured in every report

## Scenarios

| Scenario | Description |
|----------|-------------|
| Baseline | Short title, OG format (1200x630), Outfit font |
| Long text | 150+ char title causing overflow, OG format |
| Story | Long text, Story format (1080x1920) |
| CJK | Japanese text, OG format, Noto Sans JP |

## Output

- `results/YYYY-MM-DD-report.md` — human-readable report (committed)
- `results/YYYY-MM-DD-raw.json` — full raw timings (gitignored, for audit)

## Running Individual Benchmarks

```bash
# OG Engine only
bun run benchmarks/run.ts

# Puppeteer only
bun run benchmarks/puppeteer-baseline.ts
```
```

- [ ] **Step 2: Commit**

```bash
git add benchmarks/README.md
git commit -m "docs(bench): add benchmark README with methodology"
```

---

## Task 9: Delete Old Benchmark

**Files:**
- Delete: `tests/benchmark.ts`
- Modify: `package.json`

- [ ] **Step 1: Delete the old benchmark file**

```bash
rm tests/benchmark.ts
```

- [ ] **Step 2: Update package.json bench script**

In `package.json`, change the `"bench"` script from:

```json
"bench": "bun run tests/benchmark.ts"
```

To:

```json
"bench": "bun run benchmarks/run.ts"
```

- [ ] **Step 3: Commit**

```bash
git add -A tests/benchmark.ts package.json
git commit -m "chore: replace old benchmark with new benchmark suite"
```

---

## Task 10: Update All Documentation with Real Numbers

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/content/docs/quick-start.mdx`
- Modify: `docs/site/src/content/docs/compare/puppeteer.mdx`
- Modify: `docs/site/src/content/docs/blog/why-we-built-og-engine.mdx`
- Modify: `docs/site/src/content/docs/blog/how-pretext-measures-text.mdx`
- Modify: `docs/site/src/content/docs/api-reference/render.mdx`
- Modify: `docs/site/astro.config.mjs`
- Modify: `docs/analysis/GO-TO-MARKET.md`

**IMPORTANT:** This task MUST be done AFTER running the benchmark (Task 7), because the exact numbers depend on the benchmark output. The implementer must:

1. Read the benchmark report at `benchmarks/results/*-report.md` to get the actual measured numbers
2. Use those exact numbers in the documentation updates

The numbers below use **placeholders** from the spec's expected ranges. The implementer MUST replace them with the actual measured P50 values from the report.

The formatting rules are:
- Headline number = P50 full pipeline (e.g., "~Xms")
- Phase breakdown where relevant (e.g., "text layout <1ms, full render ~Xms")
- Speedup = measured OG Engine P50 / measured Puppeteer warm P50
- Never round in our favor — round conservatively or use ranges
- Add "(benchmarked)" or link to /benchmarks/ where appropriate

- [ ] **Step 1: Read the benchmark report**

```bash
cat benchmarks/results/*-report.md
```

Note the exact P50 numbers for:
- OG Engine full pipeline (baseline scenario)
- OG Engine text measure, canvas draw, PNG encode (baseline scenario)
- Puppeteer warm P50 (baseline scenario)
- Puppeteer cold P50 (baseline scenario)
- Computed speedup

- [ ] **Step 2: Update CLAUDE.md**

Find and replace these performance claims:
- "Sub-5ms renders" → "~Xms renders (text layout <1ms, PNG encode ~Yms)"
- "Instant rendering (~1-3ms)" → "Instant rendering (~Xms)"
- "300-500x speedup" → "Nx faster than Puppeteer ([benchmarked](/benchmarks/))"
- Comparison table: update "~2-5ms" to the measured full pipeline P50, keep other claims (memory, concurrency, cold start) as-is unless we have data

- [ ] **Step 3: Update index.mdx (homepage)**

Find and replace:
- Hero description: "Generate images in 2ms" → "Generate images Nx faster than Puppeteer"
- Hero tagline: "500x faster than Puppeteer" → "Nx faster than Puppeteer"
- Benchmark table: Replace "~2ms" with measured P50, update "425x" to measured speedup
- How It Works step 4: "Typical render: 2ms" → "Typical render: ~Xms"
- FAQ "How is this so fast?": adjust wording to match reality

- [ ] **Step 4: Update quick-start.mdx**

Find and replace:
- "Generated in 2ms, no browser needed." → "Generated in ~Xms, no browser needed."

- [ ] **Step 5: Update compare/puppeteer.mdx**

Replace the entire performance table with measured numbers:
- Render time: measured OG Engine P50 vs measured Puppeteer warm P50
- Update speedup ratio
- Keep memory/concurrency/cold-start claims as-is (not benchmarked yet)

- [ ] **Step 6: Update blog/why-we-built-og-engine.mdx**

Replace all "2ms", "2-5ms" with measured numbers. Update:
- "< 0.1ms" for Pretext measurement → use measured textMeasure P50
- "< 2ms" for Canvas draws → use measured canvasDraw P50
- "Total: 2-5ms" → use measured fullPipeline P50
- Benchmark table: all rows with measured data

- [ ] **Step 7: Update blog/how-pretext-measures-text.mdx**

Replace "under 0.1ms", "Sub-0.1ms", "under 0.5ms" with measured textMeasure P50 values. If textMeasure P50 is indeed under 0.1ms, keep the claim. If not, adjust.

- [ ] **Step 8: Update api-reference/render.mdx**

Replace "Sub-5ms renders" with measured full pipeline P50.

- [ ] **Step 9: Update astro.config.mjs**

In the JSON-LD `featureList` array, update "2ms render time" to the measured number.

- [ ] **Step 10: Update GO-TO-MARKET.md**

Replace "2ms", "500x", speed claims in the HN post template and Twitter thread template with measured numbers.

- [ ] **Step 11: Commit all doc updates**

```bash
git add CLAUDE.md docs/
git commit -m "docs: update all performance claims with benchmarked numbers"
```

---

## Task 11: New "How We Benchmark" Documentation Page

**Files:**
- Create: `docs/site/src/content/docs/benchmarks.mdx`
- Modify: `docs/site/astro.config.mjs`

- [ ] **Step 1: Create docs/site/src/content/docs/benchmarks.mdx**

```markdown
---
title: Benchmarks
description: Reproducible performance benchmarks for OG Engine vs Puppeteer. Run them yourself.
---

Every performance number on this site comes from a reproducible benchmark you can run on your own hardware.

## Latest Results

> Results from our benchmark machine. Your numbers will vary by hardware. Run `bun run bench:full` to measure on your own machine.

[INSERT: Copy the Summary and OG Engine Results tables from the latest benchmarks/results/*-report.md]

## Phase Breakdown

OG Engine renders are broken into three phases:

| Phase | What it does | Typical time |
|-------|-------------|-------------|
| **Text measurement** | Word-wrap computation for title + description | [INSERT measured P50] |
| **Canvas draw** | Gradient, grid, glow, text, decorations composited onto Canvas | [INSERT measured P50] |
| **PNG encode** | Canvas buffer encoded to PNG binary | [INSERT measured P50] |
| **Full pipeline** | All three (= API response time) | [INSERT measured P50] |

PNG encoding dominates the render time. The actual text layout and compositing — the part that replaces Puppeteer's browser engine — takes [INSERT canvasDraw + textMeasure P50].

## vs Puppeteer

We benchmark against real Puppeteer runs on the same machine, rendering equivalent content:

[INSERT: Copy the Speedup Comparison table from the report]

**"Warm" Puppeteer** means the browser stays open between renders (best case). **"Cold"** means a fresh browser launch per render (realistic for serverless/Lambda).

## Methodology

- **OG Engine:** 1000 iterations per scenario, 50 warmup discarded
- **Puppeteer warm:** 50 iterations, browser reused, 5 warmup
- **Puppeteer cold:** 10 iterations, fresh browser per render
- All times measured with `performance.now()`
- P50 (median) used for all headline numbers

## Run It Yourself

```bash
git clone https://github.com/phmatray/og-engine
cd og-engine
bun install
bun run fonts:download
bun run bench:full
```

Results are saved to `benchmarks/results/`. The markdown report is human-readable; the JSON contains every individual timing for your own analysis.

## Source

The benchmark code is at [`benchmarks/`](https://github.com/phmatray/og-engine/tree/main/benchmarks) in the repository.
```

**Note to implementer:** The [INSERT ...] placeholders MUST be replaced with actual numbers from the benchmark report generated in Task 7. Read `benchmarks/results/*-report.md` and copy the relevant tables/numbers.

- [ ] **Step 2: Add benchmarks page to sidebar in astro.config.mjs**

In `docs/site/astro.config.mjs`, find the sidebar array. Add after the "Playground" entry:

```javascript
{ label: 'Benchmarks', link: '/benchmarks/' },
```

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/benchmarks.mdx docs/site/astro.config.mjs
git commit -m "docs: add 'How We Benchmark' page with reproducible methodology"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Renderer phase timing | `src/engine/renderer.ts` |
| 2 | Puppeteer dep + scripts | `package.json`, `.gitignore` |
| 3 | Scenarios + stats + machine info | `benchmarks/scenarios.ts`, `stats.ts`, `machine-info.ts` |
| 4 | OG Engine benchmark runner | `benchmarks/run.ts` |
| 5 | Puppeteer baseline runner | `benchmarks/puppeteer-baseline.ts` |
| 6 | Report generator | `benchmarks/report.ts` |
| 7 | Full orchestrator + first report | `benchmarks/run-full.ts` |
| 8 | Benchmark README | `benchmarks/README.md` |
| 9 | Remove old benchmark | `tests/benchmark.ts` deleted |
| 10 | Update ALL docs with real numbers | 9 doc files |
| 11 | New "How We Benchmark" page | `docs/site/src/content/docs/benchmarks.mdx` |
