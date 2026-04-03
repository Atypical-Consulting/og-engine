# OG Engine — Headless Chrome Killer

## Handoff Brief for Claude Code

> **TL;DR:** Build a server-side image generation API powered by Pretext's text measurement engine. It replaces Puppeteer/headless Chrome for generating OG images, social cards, email banners, and dynamic visual content. Sub-5ms renders, zero browser dependencies.

---

## 1. What the POC Proved

We built a working browser-based prototype that demonstrates:

- **Canvas-based text measurement** (Pretext's core principle) computes exact line breaks, heights, and overflow for any text — including CJK, Arabic, emoji — without DOM
- **Instant rendering** (~1-3ms) vs Puppeteer (~850ms) = **300-500x speedup**
- **Multi-format output** (OG 1200×630, Twitter, Square, LinkedIn, Story)
- **Google Fonts integration** with dynamic loading
- **Background image compositing** with overlay controls
- **PNG export** directly from Canvas

The POC runs entirely client-side. The production version should run **server-side as an HTTP API**.

> **Canonical decisions:** Product decisions (pricing, auth model, feature gating) are defined in `docs/analysis/DECISIONS.md`. That file is the source of truth — all documentation and implementation must align with it.

---

## 2. Product Vision

### What it is
An API service that generates images with perfectly laid-out text. Send JSON, get back a PNG/SVG/WebP.

### Who it's for
- **SaaS platforms** generating OG/social cards per page (blogs, docs, e-commerce)
- **Email marketing tools** generating personalized banners at scale
- **Ad tech** validating creative copy fits ad unit dimensions
- **Any product** currently running Puppeteer/Playwright to render text into images

### Why it wins
| | Puppeteer | OG Engine |
|---|---|---|
| Render time | ~850ms | ~2-5ms |
| Memory per render | ~200-500MB | ~10MB |
| Infrastructure | Chrome binary, Xvfb, sandboxing | Node.js process |
| Concurrency | ~5-10 per instance | ~500+ per instance |
| Cold start | ~2-5s | ~50ms |
| Languages | All (full browser) | All (Pretext handles bidi, CJK, emoji, grapheme clusters) |

---

## 3. Technical Architecture

### Stack

```
Runtime:        Bun (preferred) or Node.js 20+
Text layout:    @chenglou/pretext (npm)
Canvas:         @napi-rs/canvas (for server-side Canvas API)
HTTP:           Hono (lightweight, works on Bun/Node/CF Workers)
Fonts:          Google Fonts downloaded + cached locally
Image output:   PNG (default), WebP, SVG
Deployment:     Docker → Fly.io / Railway / any container platform
```

### Why these choices

- **@chenglou/pretext** — the core engine. Use `prepare()` + `layout()` for height-only checks, `prepareWithSegments()` + `layoutWithLines()` when we need actual line content for rendering
- **@napi-rs/canvas** — Node-compatible Canvas API (same as browser Canvas). Fastest server-side canvas for Node/Bun. Alternative: `skia-canvas`
- **Hono** — ultra-lightweight HTTP framework, runs everywhere (Bun, Node, Cloudflare Workers, Deno)
- **Local font files** — download Google Fonts as .ttf/.woff2 and register them with the canvas. No runtime font fetching

### Project Structure

```
og-engine/
├── CLAUDE.md              # This file
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts           # HTTP server (Hono)
│   ├── api/
│   │   ├── render.ts      # POST /render endpoint
│   │   ├── validate.ts    # POST /validate endpoint (text-fits-check)
│   │   └── health.ts      # GET /health
│   ├── engine/
│   │   ├── layout.ts      # Pretext wrapper — text measurement & line breaking
│   │   ├── renderer.ts    # Canvas rendering — composites bg, text, decorations
│   │   ├── fonts.ts       # Font loading & registration
│   │   └── templates.ts   # Built-in card templates
│   ├── templates/
│   │   ├── og-default.ts  # Default OG card template
│   │   ├── social-card.ts # Social media card
│   │   ├── blog-hero.ts   # Blog post hero image
│   │   └── email-banner.ts
│   ├── fonts/             # Downloaded .ttf files
│   │   ├── inter/
│   │   ├── outfit/
│   │   ├── playfair-display/
│   │   └── ...
│   └── utils/
│       ├── color.ts       # Color manipulation
│       ├── image.ts       # Image loading/resizing
│       └── cache.ts       # LRU cache for prepared text
├── tests/
│   ├── layout.test.ts     # Text measurement accuracy tests
│   ├── render.test.ts     # Snapshot/visual regression tests
│   ├── api.test.ts        # API endpoint tests
│   └── benchmark.ts       # Performance benchmarks
└── scripts/
    └── download-fonts.ts  # Script to fetch Google Fonts
```

---

## 4. API Design

### `POST /render`

Generate an image from text + configuration.

**Request:**
```json
{
  "format": "og",
  "template": "default",
  "title": "Server-Side Text Layout Without a Browser",
  "description": "Pure JS text measurement replaces Puppeteer.",
  "author": "Pretext Engine",
  "tag": "Open Source",
  "style": {
    "accent": "#38ef7d",
    "layout": "left",
    "font": "Outfit",
    "titleSize": 48,
    "descSize": 22,
    "gradient": "void",
    "backgroundImage": null,
    "overlayOpacity": 0.65
  },
  "output": {
    "format": "png",
    "quality": 90
  }
}
```

**Response:** Binary image (PNG/WebP) with headers:
```
Content-Type: image/png
X-Render-Time-Ms: 2.34
X-Title-Lines: 2
X-Desc-Lines: 3
X-Layout-Overflow: false
```

### `POST /validate`

Check if text fits a given layout WITHOUT generating an image. Ultra-fast.

**Request:**
```json
{
  "format": "og",
  "title": "Some headline",
  "description": "Some body text",
  "font": "Outfit",
  "titleSize": 48,
  "descSize": 22,
  "maxTitleLines": 3,
  "maxDescLines": 4
}
```

**Response:**
```json
{
  "fits": true,
  "title": { "lines": 2, "maxLines": 3, "overflow": false },
  "description": { "lines": 3, "maxLines": 4, "overflow": false },
  "computeTimeMs": 0.12
}
```

### `POST /render/batch`

Render multiple images in one request (for bulk generation).

**Request:**
```json
{
  "items": [
    { "format": "og", "title": "Post 1", ... },
    { "format": "twitter", "title": "Post 2", ... }
  ]
}
```

**Response:** Multipart or ZIP archive of images.

### `GET /health`

```json
{
  "status": "ok",
  "fonts": ["Outfit", "Playfair Display", "Sora", ...],
  "formats": ["og", "twitter", "square", "linkedin", "story"],
  "templates": ["default", "social-card", "blog-hero", "email-banner"],
  "version": "0.1.0"
}
```

---

## 5. Engine Implementation Notes

### Text Layout (layout.ts)

```typescript
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

// Wrapper that returns lines + overflow info for a text block
export function layoutText(text: string, font: string, maxWidth: number, lineHeight: number, maxLines: number) {
  const prepared = prepareWithSegments(text, font)
  const { lines, height, lineCount } = layoutWithLines(prepared, maxWidth, lineHeight)
  
  const visibleLines = lines.slice(0, maxLines)
  const overflow = lineCount > maxLines
  
  // Add ellipsis to last visible line if overflow
  if (overflow && visibleLines.length > 0) {
    const last = visibleLines[visibleLines.length - 1]
    visibleLines[visibleLines.length - 1] = {
      ...last,
      text: last.text + '…'
    }
  }
  
  return { visibleLines, totalLines: lineCount, overflow, height }
}
```

### Font Registration (fonts.ts)

```typescript
import { GlobalFonts } from '@napi-rs/canvas'
import { readdir } from 'fs/promises'

export async function registerFonts(fontsDir: string) {
  // Register all .ttf files in the fonts directory
  // GlobalFonts.registerFromPath(path, familyName)
  // Build a map of available fonts for validation
}
```

### Caching Strategy

- **Font preparation cache:** Pretext's `prepare()` results can be cached per (text, font) pair using an LRU cache. This avoids re-segmenting identical strings.
- **Image cache:** Optional Redis/memory cache keyed on request hash. Most OG images are requested repeatedly (every social share hits the same URL).

---

## 6. Templates System

Templates are functions that take structured content + style and return Canvas drawing instructions:

```typescript
interface TemplateInput {
  canvas: Canvas
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  content: { title: string; description?: string; author?: string; tag?: string }
  style: { accent: string; font: string; layout: string; titleSize: number; descSize: number }
  backgroundImage?: Image | null
  overlayOpacity?: number
}

type Template = (input: TemplateInput) => RenderResult
```

Start with 4 templates:
1. **default** — accent bar, grid background, tag pill (from POC)
2. **social-card** — large centered title, minimal
3. **blog-hero** — background image focused, text overlay at bottom
4. **email-banner** — horizontal, CTA-style

---

## 7. Build Priorities

### Phase 1 — Core API (week 1)
- [ ] Project setup (Bun + Hono + TypeScript)
- [ ] Font downloading script + registration with @napi-rs/canvas
- [ ] Pretext integration for text measurement
- [ ] Canvas renderer for the default template
- [ ] `POST /render` endpoint returning PNG
- [ ] `POST /validate` endpoint
- [ ] `GET /health` endpoint
- [ ] Basic tests + benchmark script
- [ ] Dockerfile

### Phase 2 — Production Features (week 2)
- [ ] All 4 templates
- [ ] Background image upload support (multipart form)
- [ ] WebP output option
- [ ] LRU cache for prepared text
- [ ] Request validation with Zod
- [ ] Error handling + structured error responses
- [ ] Rate limiting
- [ ] CORS configuration
- [ ] Batch endpoint

### Phase 3 — Scale & Polish (week 3)
- [ ] Redis cache layer for rendered images
- [ ] API key authentication
- [ ] Usage tracking / metering
- [ ] OpenAPI/Swagger documentation
- [ ] SDK (TypeScript client library)
- [ ] Deploy to Fly.io with auto-scaling
- [ ] Landing page

### Phase 4 — Growth (future)
- [ ] Custom template builder (JSON DSL)
- [ ] Webhook triggers (auto-regenerate on content update)
- [ ] Edge deployment (Cloudflare Workers — may need alternative to @napi-rs/canvas)
- [ ] AI text fitting: auto-adjust font size to fit constraints
- [ ] PDF output

---

## 8. Key Decisions to Make

1. **@napi-rs/canvas vs skia-canvas vs node-canvas?**
   → Recommend @napi-rs/canvas for performance. Benchmark all three.

2. **Bun vs Node?**
   → Bun preferred for speed + native TypeScript. Ensure @napi-rs/canvas works in Bun (has native addon support since 1.0).

3. **Pricing model?**
   → Free tier: 500 renders/month. Starter: €10/mo for 10k. Pro: €39/mo for 50k. Scale: €99/mo for 200k. See docs/analysis/DECISIONS.md for canonical pricing.

4. **Monorepo or separate repos?**
   → Start monorepo: API + landing page + SDK in one repo.

---

## 9. Reference

- **Pretext repo:** https://github.com/chenglou/pretext
- **Pretext npm:** `@chenglou/pretext`
- **@napi-rs/canvas:** https://github.com/nicknisi/canvas
- **Hono:** https://hono.dev
- **POC code:** See the og-engine.jsx artifact from this conversation for the rendering logic — it's directly portable to server-side Canvas

---

## 10. First Command for Claude Code

```bash
mkdir og-engine && cd og-engine
bun init -y
bun add @chenglou/pretext @napi-rs/canvas hono zod
bun add -d typescript @types/node vitest
```

Then: implement `src/index.ts` with the Hono server, `src/engine/layout.ts` with Pretext integration, and `src/engine/renderer.ts` with the Canvas rendering logic ported from the POC.
