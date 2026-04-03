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
