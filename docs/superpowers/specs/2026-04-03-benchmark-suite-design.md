# Reproducible Benchmark Suite — Design Spec

**Goal:** Build a rigorous, reproducible benchmark suite that measures OG Engine performance with phase-level granularity, compares against real Puppeteer runs, and produces defensible numbers for marketing. Then update all documentation to match measured reality.

**Why:** Current docs claim "~2ms" renders. Actual measured time is ~23ms (including PNG encoding). Every performance number across 10+ files is wrong. Marketing depends on credible, reproducible claims.

---

## 1. What We Measure

### OG Engine — Phase Breakdown

Each render is instrumented into three phases:

| Phase | What it does | Expected range |
|-------|-------------|----------------|
| **Text measurement** | `measureLines()` for title + description | <1ms |
| **Canvas draw** | Gradient, grid, glow, accent bar, tag, title, description, author, badge, frame | 2-5ms |
| **PNG encode** | `canvas.toBuffer('image/png')` | 15-20ms |
| **Full pipeline** | All three combined | 20-25ms |

The full pipeline is what a real `POST /render` API call returns. That's the honest number.

### Puppeteer Baseline

Same content rendered via Puppeteer for apples-to-apples comparison:

1. Launch browser (or reuse from pool)
2. Create page, set viewport to 1200x630
3. Set HTML content with inline CSS (matching OG Engine's visual output)
4. Screenshot as PNG
5. Close page

Puppeteer is measured two ways:
- **Cold** — fresh browser launch per render (worst case)
- **Warm** — browser reused, new page per render (best case for Puppeteer)

### Scenarios

| Scenario | Title | Format | Font |
|----------|-------|--------|------|
| **Baseline** | "Hello, OG Engine" (1 line) | og (1200x630) | Outfit |
| **Long text** | 150+ chars, forces 5+ line overflow | og | Outfit |
| **Story format** | Same long text | story (1080x1920) | Outfit |
| **CJK** | Japanese text | og | Noto Sans JP |
| **All formats** | Baseline title, all 5 formats | og/twitter/square/linkedin/story | Outfit |

---

## 2. Statistical Methodology

- **1000 iterations** per scenario after **50 warmup** iterations (discarded)
- **3 complete runs** of the full suite; report the **median run** by P50 full-pipeline time
- Prevents cherry-picking the best or worst run

**Reported metrics per scenario:**
- Min, P50 (median), P95, P99, Max
- Mean, Standard deviation
- Speedup ratio vs Puppeteer P50

**Machine context captured:**
- OS name + version
- CPU model + core count
- Total RAM
- Bun version
- Node.js version (for Puppeteer)
- `@napi-rs/canvas` version
- `puppeteer` version
- Timestamp (ISO 8601)

---

## 3. Renderer Instrumentation

Add an optional `timing` flag to `RenderOptions`. When true, the returned `RenderResult` includes a `phases` object:

```typescript
interface RenderPhases {
  textMeasureMs: number;  // measureLines() calls
  canvasDrawMs: number;   // all ctx.* calls
  pngEncodeMs: number;    // canvas.toBuffer()
  totalMs: number;        // sum of above
}

interface RenderResult {
  // ... existing fields ...
  phases?: RenderPhases;  // only present when timing: true
}
```

Implementation: wrap each phase with `performance.now()` calls inside `renderCard()`. The `timing` flag defaults to `false` so production performance is unaffected (no measurement overhead in hot path).

---

## 4. File Structure

```
benchmarks/
├── run.ts                    # Main benchmark runner
├── puppeteer-baseline.ts     # Puppeteer comparison runner
├── scenarios.ts              # Scenario definitions
├── report.ts                 # Markdown + JSON report generator
├── results/                  # Output directory (gitignored except reports)
│   └── .gitkeep
└── README.md                 # How to run, methodology explanation
```

**Changes to existing files:**
- `src/engine/renderer.ts` — add `timing` flag + phase measurement
- `package.json` — add `puppeteer` as devDependency, add `bench:full` script
- `.gitignore` — add `benchmarks/results/*.json` (raw data is large)

---

## 5. Output Artifacts

### Console output (when run interactively)

```
OG Engine Benchmark Suite
Machine: macOS 15.4 / Apple M2 Pro / 16GB / Bun 1.2.x

Scenario: Baseline (og, 1 line, Outfit)
  Text measure:  0.08ms (P50)  0.12ms (P95)
  Canvas draw:   3.21ms (P50)  4.10ms (P95)
  PNG encode:   18.44ms (P50) 19.81ms (P95)
  Full pipeline: 21.73ms (P50) 24.03ms (P95)

Scenario: Long text (og, overflow, Outfit)
  ...

Puppeteer Baseline (warm):
  Full pipeline: 847ms (P50) 1203ms (P95)

Speedup: 39x (P50 vs P50)
```

### Markdown report (`benchmarks/results/YYYY-MM-DD-report.md`)

Full tables, machine context, methodology description, all scenarios. This file IS committable — it's the proof.

### JSON raw data (`benchmarks/results/YYYY-MM-DD-raw.json`)

Every individual timing for every iteration. Gitignored (large) but available for external audit. Structure:

```json
{
  "machine": { "os": "...", "cpu": "...", "ram": "...", "bun": "...", "node": "..." },
  "timestamp": "2026-04-03T...",
  "methodology": { "iterations": 1000, "warmup": 50, "runs": 3, "selectedRun": 2 },
  "scenarios": {
    "baseline": {
      "ogEngine": {
        "phases": { "textMeasure": [0.08, 0.07, ...], "canvasDraw": [...], "pngEncode": [...] },
        "fullPipeline": [21.7, 22.1, ...]
      },
      "puppeteer": { "warm": [847, 851, ...], "cold": [2340, 2100, ...] }
    }
  }
}
```

---

## 6. Documentation Updates

Once benchmark produces real numbers, update ALL performance claims. Files to update:

| File | Claims to update |
|------|-----------------|
| `CLAUDE.md` | "Sub-5ms renders", "~1-3ms", "300-500x", comparison table |
| `docs/site/src/content/docs/index.mdx` | Hero tagline, benchmark table, FAQ, How It Works |
| `docs/site/src/content/docs/quick-start.mdx` | "Generated in 2ms" |
| `docs/site/src/content/docs/compare/puppeteer.mdx` | Full comparison table, migration guide |
| `docs/site/src/content/docs/blog/why-we-built-og-engine.mdx` | All benchmark numbers, architecture description |
| `docs/site/src/content/docs/blog/how-pretext-measures-text.mdx` | Sub-0.1ms claims, phase breakdowns |
| `docs/site/src/content/docs/api-reference/render.mdx` | "Sub-5ms renders" |
| `docs/site/astro.config.mjs` | JSON-LD schema featureList |
| `docs/analysis/GO-TO-MARKET.md` | HN post, Twitter thread, all speed claims |

**Formatting rules for updated claims:**
- Headline number = **P50 full pipeline** (e.g., "~22ms")
- Phase breakdown where relevant (e.g., "text layout <1ms, full render ~22ms")
- Speedup = measured OG Engine P50 / measured Puppeteer P50 (e.g., "~39x faster")
- Never round in our favor — round conservatively or use ranges
- Add footnote/link to benchmark methodology page

**New documentation page:**
- `docs/site/src/content/docs/benchmarks.mdx` — "How We Benchmark" page explaining methodology, linking to the benchmark script, showing how to reproduce. This replaces vague claims with verifiable ones.

---

## 7. Marketing Narrative Adjustment

The story changes from "2ms renders" to something like:

> **~22ms full renders. 39x faster than Puppeteer. Text layout under 1ms.**

The narrative pivot: OG Engine's advantage isn't just raw speed — it's the **architecture**. No browser, no Chrome, no Xvfb, 50x less memory, 500+ concurrent renders on a single Node process. The speed comparison is real (39x) even if the absolute number is higher than originally claimed.

The phase breakdown lets us say: "The actual text layout and compositing takes <5ms. PNG encoding adds ~18ms — and that's the same encoding cost any solution pays, including Puppeteer."

---

## 8. Scope Boundaries

**In scope:**
- Renderer phase instrumentation
- Benchmark runner with scenarios
- Puppeteer baseline comparison
- Report generation (markdown + JSON)
- All documentation updates to match real numbers
- New "How We Benchmark" docs page

**Out of scope:**
- WebP encoding benchmark (not yet implemented)
- Network latency simulation
- Concurrent request benchmarking (load testing)
- Memory profiling (separate concern)
- CI integration for regression tracking (future)
