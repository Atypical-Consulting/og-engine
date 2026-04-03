<p align="center">
  <img src="https://img.shields.io/badge/render_time-~22ms-00d084?style=for-the-badge" alt="Render Time ~22ms" />
  <img src="https://img.shields.io/badge/memory-10MB_per_render-blue?style=for-the-badge" alt="Memory 10MB" />
  <img src="https://img.shields.io/badge/zero-browser_deps-purple?style=for-the-badge" alt="Zero Browser Dependencies" />
</p>

<h1 align="center">OG Engine</h1>

<p align="center">
  <strong>Generate OG images in milliseconds. No browser. No Puppeteer. No BS.</strong>
</p>

<p align="center">
  Server-side image generation API powered by Canvas-based text measurement.<br/>
  Drop-in replacement for Puppeteer/Playwright image pipelines.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#api-reference">API Reference</a> &bull;
  <a href="#self-hosting">Self-Host</a> &bull;
  <a href="#benchmarks">Benchmarks</a> &bull;
  <a href="#templates">Templates</a> &bull;
  <a href="#roadmap">Roadmap</a>
</p>

---

## Why OG Engine?

Every time you generate an OG image with Puppeteer, you're spinning up a **full Chromium instance** to render some text on a rectangle. That's 500MB of RAM and ~129ms (warm) to ~658ms (cold) of latency — for a PNG.

OG Engine measures text and renders images using server-side Canvas. No DOM, no browser, no headless anything.

| | Puppeteer | **OG Engine** |
|---|---|---|
| Render time | ~129ms (warm) / ~658ms (cold) | **~22ms** |
| Memory per render | ~200-500MB | **~10MB** |
| Infrastructure | Chrome binary, Xvfb, sandboxing | **Node.js process** |
| Concurrency | ~5-10 per instance | **~500+ per instance** |
| Cold start | ~2-5s | **~50ms** |
| CJK / Arabic / Emoji | Yes (full browser) | **Yes** (native Unicode support) |

## Quick Start

### One-liner

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello, OG Engine", "format": "og"}' \
  --output card.png
```

### Run locally

```bash
# Clone & install
git clone https://github.com/Atypical-Consulting/og-engine.git
cd og-engine
bun install

# Download fonts (required on first run)
bun run fonts:download

# Start the server
bun run dev
# → Server running at http://localhost:3000
```

### With Docker

```bash
docker build -t og-engine .
docker run -p 3000:3000 og-engine
```

## API Reference

### `POST /render`

Generate an image from text + configuration.

```json
{
  "format": "og",
  "title": "Server-Side Text Layout Without a Browser",
  "description": "Pure JS text measurement replaces Puppeteer.",
  "author": "OG Engine",
  "tag": "Open Source",
  "style": {
    "accent": "#38ef7d",
    "layout": "left",
    "font": "Outfit",
    "titleSize": 48,
    "descSize": 22,
    "gradient": "void",
    "overlayOpacity": 0.65
  },
  "output": {
    "format": "png",
    "quality": 90
  }
}
```

**Response:** Binary PNG with performance headers:

```
Content-Type: image/png
X-Render-Time-Ms: 2.34
X-Title-Lines: 2
X-Desc-Lines: 3
X-Layout-Overflow: false
```

### `POST /validate`

Check if text fits without generating an image. Ultra-fast.

```json
{
  "format": "og",
  "title": "Some headline",
  "description": "Some body text",
  "font": "Outfit",
  "titleSize": 48,
  "maxTitleLines": 3
}
```

```json
{
  "fits": true,
  "title": { "lines": 2, "maxLines": 3, "overflow": false },
  "description": { "lines": 1, "maxLines": 4, "overflow": false },
  "computeTimeMs": 0.12
}
```

### `GET /health`

```json
{
  "status": "ok",
  "fonts": ["Outfit", "Inter", "Playfair Display", "Sora", "Space Grotesk", "JetBrains Mono", "Noto Sans JP", "Noto Sans AR"],
  "formats": ["og", "twitter", "square", "linkedin", "story"],
  "templates": ["default", "social-card", "blog-hero", "email-banner"],
  "version": "0.1.0"
}
```

## Formats

| Format | Dimensions | Use case |
|--------|-----------|----------|
| `og` | 1200 × 630 | Open Graph / Facebook |
| `twitter` | 1200 × 675 | Twitter/X cards |
| `square` | 1080 × 1080 | Instagram / general social |
| `linkedin` | 1200 × 627 | LinkedIn posts |
| `story` | 1080 × 1920 | Instagram/TikTok stories |

## Fonts

8 fonts included out of the box, with full Unicode coverage:

| Font | Weights | Script support |
|------|---------|---------------|
| Outfit | 400, 700, 800 | Latin |
| Inter | 400, 700, 800 | Latin |
| Playfair Display | 400, 700, 800 | Latin |
| Sora | 400, 700, 800 | Latin |
| Space Grotesk | 400, 700 | Latin |
| JetBrains Mono | 400, 700 | Latin (monospace) |
| Noto Sans JP | 400, 700 | Japanese / CJK |
| Noto Sans Arabic | 400, 700 | Arabic / RTL |

## Style Options

**6 built-in gradients:** `void` `deep-sea` `ember` `forest` `plum` `slate`

**3 layout modes:** `left` `center` `bottom`

**Full control over:** accent color, font, title/description size, overlay opacity, tag pill, author line.

## Templates

| Template | Description |
|----------|------------|
| `default` | Accent bar, grid background, tag pill — the classic OG card |
| `social-card` | Large centered title, minimal and clean |
| `blog-hero` | Background image focused with text overlay |
| `email-banner` | Horizontal CTA-style for email campaigns |

## Integration Examples

### Next.js App Router

```typescript
// app/api/og/[slug]/route.ts
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)

  const res = await fetch('http://localhost:3000/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'og',
      title: post.title,
      description: post.excerpt,
      tag: post.category,
      style: { accent: '#38ef7d', font: 'Outfit' }
    })
  })

  return new Response(res.body, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }
  })
}
```

### Node.js / Express

```typescript
import express from 'express'

const app = express()

app.get('/og/:slug', async (req, res) => {
  const image = await fetch('http://localhost:3000/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'og',
      title: `My Blog — ${req.params.slug}`,
      style: { gradient: 'deep-sea' }
    })
  })

  res.set('Content-Type', 'image/png')
  res.send(Buffer.from(await image.arrayBuffer()))
})
```

### cURL

```bash
# Generate an OG image
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "title": "How We Killed Puppeteer",
    "description": "And saved 500MB of RAM per render.",
    "format": "og",
    "tag": "Engineering",
    "style": { "accent": "#ff6b6b", "gradient": "ember", "font": "Playfair Display" }
  }' \
  --output og-card.png

# Check if text fits before rendering
curl -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{"title": "Will this headline fit?", "format": "og", "titleSize": 48}'
```

## Benchmarks

Measured on Apple M2, 8 cores, 24 GB RAM, Bun 1.3.11. 1,000 iterations per scenario with 50 warmup (discarded). Full report: [`benchmarks/results/2026-04-03-report.md`](benchmarks/results/2026-04-03-report.md).

### OG Engine Results

| Scenario | Text Measure (P50) | Canvas Draw (P50) | PNG Encode (P50) | Full Pipeline (P50) | Full Pipeline (P95) |
|---|---|---|---|---|---|
| Baseline (og, 1 line, Outfit) | 114µs | 50µs | 21.39ms | **21.57ms** | 22.79ms |
| Long text (og, overflow, Outfit) | 390µs | 78µs | 24.34ms | **24.83ms** | 26.41ms |
| Story format (1080×1920, Outfit) | 426µs | 98µs | 59.37ms | **59.96ms** | 65.02ms |
| CJK (og, Noto Sans JP) | 126µs | 79µs | 24.12ms | **24.34ms** | 26.92ms |

### vs Puppeteer

| Scenario | OG Engine (P50) | Puppeteer Warm (P50) | Puppeteer Cold (P50) | Speedup (warm) |
|---|---|---|---|---|
| Baseline | **21.57ms** | 128.75ms | 657.55ms | **6x** |
| Long text | **24.83ms** | 132.14ms | 634.03ms | **5x** |

### Run it yourself

```bash
bun run bench          # OG Engine only
bun run bench:full     # Includes Puppeteer comparison
```

## Self-Hosting

OG Engine is designed to self-host. It's a single Bun/Node.js process with no external dependencies.

**Requirements:**
- Bun 1.0+ (recommended) or Node.js 20+
- ~50MB disk (fonts + binary)
- ~10MB RAM per concurrent render

```bash
# Production
bun run start

# Or with Node.js
npx tsx src/index.ts
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | [Bun](https://bun.sh) | Native TypeScript, fast startup |
| HTTP | [Hono](https://hono.dev) | Ultra-light, runs everywhere |
| Canvas | [@napi-rs/canvas](https://github.com/nicknisi/canvas) | Fastest server-side Canvas for Node/Bun |
| Validation | [Zod](https://zod.dev) | Type-safe request validation |
| Fonts | Google Fonts (TTF) | Downloaded locally, zero runtime fetching |

## Project Structure

```
og-engine/
├── src/
│   ├── index.ts              # Hono server
│   ├── api/
│   │   ├── render.ts         # POST /render — image generation
│   │   ├── validate.ts       # POST /validate — text fit check
│   │   └── health.ts         # GET /health — discovery
│   ├── engine/
│   │   ├── text-measure.ts   # Line breaking & text measurement
│   │   ├── renderer.ts       # Canvas compositing & rendering
│   │   ├── fonts.ts          # Font loading & registration
│   │   ├── formats.ts        # Format definitions (og, twitter, etc.)
│   │   └── gradients.ts      # Gradient presets
│   └── schemas/
│       └── request.ts        # Zod request schemas
├── fonts/                    # TTF files (downloaded at build time)
├── benchmarks/               # Performance benchmark suite
└── tests/                    # Vitest test suite
```

## Roadmap

- [x] **Phase 1 — Core API** *(complete)*
  - Hono server with render, validate, health endpoints
  - Canvas-based text measurement engine
  - 5 formats, 6 gradients, 8 fonts
  - Zod validation, CORS, error handling
  - Benchmark suite with statistical analysis

- [ ] **Phase 2 — Production Features**
  - All 4 templates (social-card, blog-hero, email-banner)
  - Background image upload (multipart)
  - WebP output
  - LRU text cache, batch endpoint, rate limiting

- [ ] **Phase 3 — Scale & Polish**
  - API key authentication & usage tracking
  - Redis cache layer
  - OpenAPI documentation
  - TypeScript SDK (npm)
  - Docker + Fly.io deployment

- [ ] **Phase 4 — Growth**
  - Custom template builder (JSON DSL)
  - AI text fitting (auto font-size adjustment)
  - Edge deployment (Cloudflare Workers)
  - PDF output, webhook triggers

## Comparison with Alternatives

| Feature | OG Engine | @vercel/og | Puppeteer | Cloudinary |
|---------|-----------|-----------|-----------|------------|
| Render speed | ~22ms | ~50-200ms | ~129ms (warm) / ~658ms (cold) | ~500ms |
| Self-hostable | Yes | Vercel only | Yes | No |
| No browser needed | Yes | Yes (Satori) | No | N/A |
| CJK/Arabic/Emoji | Yes | Partial | Yes | Yes |
| Multiple formats | 5 | 1 | Any | Many |
| Custom fonts | 8 built-in | Manual setup | Any | Limited |
| Text validation | Yes | No | No | No |
| Batch rendering | Planned | No | Manual | Yes |
| Open source | Yes | Yes | Yes | No |

## Contributing

Contributions are welcome! Here's how to get started:

```bash
git clone https://github.com/Atypical-Consulting/og-engine.git
cd og-engine
bun install
bun run fonts:download
bun run test
bun run dev
```

**Areas where help is needed:**
- Additional templates and gradient presets
- Font coverage (more scripts/languages)
- Integration examples (Astro, Nuxt, SvelteKit, etc.)
- Performance optimizations in the rendering pipeline
- Visual regression test suite

## License

MIT

---

<p align="center">
  <strong>If OG Engine saves you from running Puppeteer, consider giving it a star.</strong><br/>
  It helps others discover the project.
</p>

<p align="center">
  <a href="https://github.com/Atypical-Consulting/og-engine">
    <img src="https://img.shields.io/github/stars/Atypical-Consulting/og-engine?style=social" alt="GitHub Stars" />
  </a>
</p>
