# OG Engine Documentation & User Manual — Design Spec

> **Goal:** Build a complete, Stripe-quality documentation site before writing any API code. The docs become the definitive spec. An embedded interactive playground (client-side Canvas from the POC) lets visitors try the product before it exists.

---

## 1. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Audience | Developers + marketing (Stripe-style) | Docs that sell by being excellent |
| Language | English only | Global reach, consistent with HN/PH launch |
| Platform | Standalone Starlight (Astro) site | Professional from day one, fast, customizable |
| API reference depth | OpenAPI 3.1 spec + prose guides | Machine-readable contract + human-friendly guides |
| Interactive elements | Full embedded playground | Client-side Canvas from POC, zero API dependency |
| Approach | Docs-first, code-later | Docs are the spec; no ambiguity when implementing |

---

## 2. Project Structure

The docs site lives inside the main `og-engine` monorepo:

```
og-engine/
├── docs/
│   ├── analysis/                  # (existing) planning docs
│   └── site/                      # Starlight docs site
│       ├── astro.config.mjs
│       ├── package.json
│       ├── tsconfig.json
│       ├── public/
│       │   └── openapi.json       # OpenAPI 3.1 spec (hand-written)
│       ├── src/
│       │   ├── assets/
│       │   │   └── logo.svg
│       │   ├── styles/
│       │   │   └── custom.css     # Dark theme, #38ef7d accent
│       │   ├── content/
│       │   │   └── docs/
│       │   │       ├── index.mdx
│       │   │       ├── quick-start.mdx
│       │   │       ├── guides/
│       │   │       │   ├── generating-images.mdx
│       │   │       │   ├── formats-and-templates.mdx
│       │   │       │   ├── customizing-styles.mdx
│       │   │       │   ├── background-images.mdx
│       │   │       │   ├── text-validation.mdx
│       │   │       │   ├── batch-rendering.mdx
│       │   │       │   └── error-handling.mdx
│       │   │       ├── api-reference/
│       │   │       │   ├── overview.mdx
│       │   │       │   ├── render.mdx
│       │   │       │   ├── validate.mdx
│       │   │       │   ├── batch.mdx
│       │   │       │   ├── health.mdx
│       │   │       │   └── errors.mdx
│       │   │       ├── sdk/
│       │   │       │   ├── installation.mdx
│       │   │       │   └── reference.mdx
│       │   │       ├── templates/
│       │   │       │   └── gallery.mdx
│       │   │       ├── fonts/
│       │   │       │   └── available-fonts.mdx
│       │   │       ├── self-hosting/
│       │   │       │   └── docker.mdx
│       │   │       ├── pricing.mdx
│       │   │       └── changelog.mdx
│       │   └── components/
│       │       ├── Playground.tsx          # Full playground (standalone page)
│       │       ├── PlaygroundMini.tsx      # Compact version (home page)
│       │       ├── PlaygroundContextual.tsx # Configurable version (guides)
│       │       ├── engine/
│       │       │   ├── canvas-renderer.ts  # POC Canvas logic, ported to TS
│       │       │   ├── text-measure.ts     # measureLines() from POC
│       │       │   ├── fonts.ts            # Web font loading (Google Fonts CDN)
│       │       │   ├── gradients.ts        # Gradient presets
│       │       │   └── formats.ts          # Format dimensions + constraints
│       │       └── ui/
│       │           ├── JsonEditor.tsx       # Editable JSON panel
│       │           ├── StyleControls.tsx    # Color picker, sliders, dropdowns
│       │           ├── FormatSelector.tsx   # Format cards with dimensions
│       │           ├── TemplateSelector.tsx # Template thumbnails
│       │           └── CodeOutput.tsx       # curl/SDK code generation
│       └── ...
├── src/                           # (future) API source code
├── CLAUDE.md
└── README.md
```

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Astro 5.x + Starlight | Fast, static, built-in search, sidebar, dark mode |
| Interactive components | React 19 (Astro islands) | POC is React; islands keep static pages fast |
| Playground rendering | Canvas API (client-side) | Direct port from POC; zero backend dependency |
| Fonts (playground) | Google Fonts CDN, loaded on demand | Same fonts as server, no bundling needed |
| API spec | OpenAPI 3.1 (hand-written JSON) | Formal contract; importable into Postman/Swagger |
| Styling | Starlight defaults + custom CSS overrides | Dark-only theme with #38ef7d accent |

### Package Dependencies

```json
{
  "name": "og-engine-docs",
  "dependencies": {
    "astro": "^5.x",
    "@astrojs/starlight": "^0.x",
    "@astrojs/react": "^4.x",
    "react": "^19.x",
    "react-dom": "^19.x"
  },
  "devDependencies": {
    "typescript": "^5.x"
  }
}
```

---

## 4. Home Page

The first thing a developer sees. Sells in 10 seconds, gets them to a working curl command in 30.

### Hero

- **Tagline:** "Generate images in 2ms. No browser required."
- **Subtitle:** "OG Engine is a server-side image generation API. Send JSON, get back a PNG. Replaces Puppeteer at 500x the speed."
- **CTAs:** "Get Started Free" -> quick-start | "Try the Playground" -> playground section
- **Stats bar:** `2ms render` / `10MB memory` / `500+ concurrent` / `CJK/Arabic/Emoji`

### Below the Fold

- **Code comparison panel:** 3-tab view showing `curl`, `TypeScript SDK`, `Next.js integration`
- **Comparison table:** Puppeteer vs OG Engine (render time, memory, concurrency, cold start, infra)
- **Embedded mini-playground:** live title/description input -> instant Canvas preview
- **Formats strip:** OG 1200x630, Twitter, Square, LinkedIn, Story with dimension badges

---

## 5. Sidebar Navigation

```
Home
Quick Start

Guides
  Generating Images
  Formats & Templates
  Customizing Styles
  Background Images
  Text Validation
  Batch Rendering
  Error Handling

API Reference
  Overview
  POST /render
  POST /validate
  POST /render/batch
  GET /health
  Errors

SDK
  Installation
  Reference

Templates
  Gallery

Fonts
  Available Fonts

Self-Hosting
  Docker

Pricing & Limits
Changelog
```

---

## 6. Quick Start Guide

Five steps, under 2 minutes. The most important page in the docs.

### Step 1 — Get your API key

```bash
curl -X POST https://api.og-engine.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

Response:

```json
{ "apiKey": "oge_sk_a1b2c3...", "plan": "free", "limit": 500 }
```

> Check your email. Your API key is also in the response above.

### Step 2 — Generate your first image

```bash
curl -X POST https://api.og-engine.com/render \
  -H "Authorization: Bearer oge_sk_a1b2c3..." \
  -H "Content-Type: application/json" \
  -d '{"format": "og", "title": "Hello, OG Engine"}' \
  --output hello.png
```

Side-by-side display: curl command on the left, resulting image on the right (rendered live by the playground component).

### Step 3 — Customize it

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

Embedded playground: the user can edit the JSON and see the image update live.

### Step 4 — Check if text fits (free, unlimited)

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

### Step 5 — Use the SDK (optional)

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

### End of Quick Start

> That's it. You're generating images. Next: explore [Templates](/templates/gallery), learn about [Formats](/guides/formats-and-templates), or dive into the [API Reference](/api-reference/overview).

Three links, no dead ends.

---

## 7. Guides

Seven guides. Each follows the same pattern: **what -> why -> how -> example -> playground**.

### Guide 1 — Generating Images

The foundational guide. Covers the full `/render` request lifecycle.

- What happens when you call `/render` (text measurement -> layout -> canvas draw -> PNG encode)
- Minimal request (just `format` + `title`)
- Full request with all fields
- Reading response headers (`X-Render-Time-Ms`, `X-Title-Lines`, `X-Layout-Overflow`)
- Output formats: PNG (default) vs WebP (Starter+)
- Quality setting for WebP
- **Playground:** editable request -> live image preview + response headers displayed

### Guide 2 — Formats & Templates

- The 5 format presets with exact dimensions and visual preview of each:
  - `og` 1200x630
  - `twitter` 1200x675
  - `square` 1080x1080
  - `linkedin` 1200x627
  - `story` 1080x1920
- How format affects max title/description lines
- The 4 templates with side-by-side visual comparison:
  - `default` — accent bar, grid background, tag pill
  - `social-card` — large centered title, minimal
  - `blog-hero` — background image, text overlay at bottom
  - `email-banner` — horizontal, CTA-style
- Combining format + template (which combos work best)
- **Playground:** format/template dropdowns -> instant preview of all combinations

### Guide 3 — Customizing Styles

- `style.accent` — hex color, affects accent bar + tag pill + decorations
- `style.font` — available fonts (link to Fonts page)
- `style.titleSize` / `style.descSize` — sizing with min/max bounds (28-72 / 14-32)
- `style.layout` — `left`, `center`, `bottom` with visual comparison
- `style.gradient` — the 6 background gradients with swatches: Void, Deep Sea, Ember, Forest, Plum, Slate
- Defaults: what you get when you omit style fields
- **Playground:** style sliders and pickers -> live image update

### Guide 4 — Background Images

- Uploading via multipart form (curl + SDK examples)
- How the image is composited (cover crop + dark overlay)
- Controlling `style.overlayOpacity` (0.2-0.9) with visual before/after
- Accepted formats: JPEG, PNG, WebP
- Size limit: 5MB
- How background interacts with templates (`blog-hero` is designed for this)
- **Playground:** image URL input -> preview with overlay slider

### Guide 5 — Text Validation

- Why validate before rendering (save API calls, validate user input)
- The `/validate` endpoint — free, unlimited, not metered
- Basic validation: does the text fit?
- Custom constraints: `maxTitleLines`, `maxDescLines`
- Custom font/size validation
- Using validation in a form (check on blur, show warning before publish)
- **Playground:** type text -> see line count + overflow status in real-time

### Guide 6 — Batch Rendering

- When to use batch (bulk blog OG images, e-commerce catalog, email campaigns)
- Request structure: array of items
- Response: ZIP archive with numbered images
- Error handling: partial failures, `errors.json` inside the ZIP
- Plan restriction: Pro and Scale only
- Performance: N images in ~Nx3ms (parallel rendering)
- curl and SDK examples for batch

### Guide 7 — Error Handling

- Error response structure: `{ error, message, details }`
- Full error code reference table (see Section 9 below)
- Rate limiting headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- What to do when rate limited (upgrade link in response)
- Retry strategy for 5xx errors (SDK handles this automatically)
- Structured error examples for each error code

---

## 8. API Reference

Every endpoint page follows an identical structure for predictable scanning:

```
1. Endpoint signature       POST /render
2. One-line description     Generate an image from text + configuration.
3. Authentication           Required (Bearer token) | or Public
4. Plan availability        Free / Starter / Pro / Scale
5. Rate limiting            Counts toward monthly quota | or Not metered
6. Request
   - Headers (table)
   - Body schema (table: field, type, required, default, description)
   - Full example request
7. Response
   - Success (status code, headers, body)
   - Full example response
8. Errors (table: status, error code, when it happens)
9. Playground               Embedded interactive panel
```

### POST /render

Generate an image from text + configuration.

**Authentication:** Required (Bearer token)
**Plan availability:** All plans
**Rate limiting:** Counts toward monthly quota

**Request body:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `format` | string | yes | — | `og`, `twitter`, `square`, `linkedin`, `story` |
| `template` | string | no | `"default"` | `default`, `social-card`, `blog-hero`, `email-banner` |
| `title` | string | yes | — | Main heading text (max 200 chars) |
| `description` | string | no | — | Body text (max 500 chars) |
| `author` | string | no | — | Author name |
| `tag` | string | no | — | Category badge displayed as uppercase pill |
| `style.accent` | string | no | `"#38ef7d"` | Hex color for accent elements |
| `style.font` | string | no | `"Outfit"` | Font family name (see GET /health for list) |
| `style.titleSize` | number | no | `48` | Title font size, range 28-72 |
| `style.descSize` | number | no | `22` | Description font size, range 14-32 |
| `style.layout` | string | no | `"left"` | Text alignment: `left`, `center`, `bottom` |
| `style.gradient` | string | no | `"void"` | Background gradient: `void`, `deep-sea`, `ember`, `forest`, `plum`, `slate` |
| `style.overlayOpacity` | number | no | `0.65` | Background image overlay opacity, range 0.2-0.9 |
| `output.format` | string | no | `"png"` | Output format: `png`, `webp` (Starter+ only) |
| `output.quality` | number | no | `90` | WebP quality, range 1-100 |

**Response:** Binary image with headers:

| Header | Example | Description |
|---|---|---|
| `Content-Type` | `image/png` | Output MIME type |
| `X-Render-Time-Ms` | `2.34` | Server-side render duration |
| `X-Title-Lines` | `2` | Lines the title occupies |
| `X-Desc-Lines` | `3` | Lines the description occupies |
| `X-Layout-Overflow` | `false` | Whether text was truncated |
| `X-RateLimit-Limit` | `500` | Monthly call limit |
| `X-RateLimit-Remaining` | `347` | Calls remaining this period |
| `X-RateLimit-Reset` | `2026-05-01T00:00:00Z` | Counter reset timestamp |

### POST /validate

Check if text fits a given layout without generating an image.

**Authentication:** Not required
**Plan availability:** All plans (free, unlimited)
**Rate limiting:** Not metered

**Request body:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `format` | string | yes | — | Image format preset |
| `title` | string | yes | — | Title text to measure |
| `description` | string | no | — | Description text to measure |
| `font` | string | no | `"Outfit"` | Font for measurement |
| `titleSize` | number | no | `48` | Title font size |
| `descSize` | number | no | `22` | Description font size |
| `maxTitleLines` | number | no | `3` | Max allowed title lines |
| `maxDescLines` | number | no | `4` | Max allowed description lines |

**Response:**

```json
{
  "fits": true,
  "title": { "lines": 2, "maxLines": 3, "overflow": false },
  "description": { "lines": 3, "maxLines": 4, "overflow": false },
  "computeTimeMs": 0.12
}
```

### POST /render/batch

Render multiple images in one request.

**Authentication:** Required (Bearer token)
**Plan availability:** Pro and Scale only
**Rate limiting:** Each item counts as 1 API call

**Request body:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `items` | array | yes | — | Array of render requests, max 100 items |

Each item follows the same schema as POST /render.

**Response:** ZIP archive (`application/zip`) containing:
- `0.png`, `1.png`, ... — rendered images (numbered by array index)
- `errors.json` — partial failures listing index + error message (only present if errors occurred)

**Response headers:**

| Header | Example | Description |
|---|---|---|
| `X-Total-Render-Time-Ms` | `142.5` | Total render time for all items |
| `X-Batch-Count` | `50` | Number of items processed |
| `X-Batch-Errors` | `2` | Number of failed items |

### GET /health

Discovery endpoint for API capabilities.

**Authentication:** Not required (public)
**Rate limiting:** Not metered

**Response:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "fonts": ["Outfit", "Inter", "Playfair Display", "Sora", "Space Grotesk", "JetBrains Mono", "Noto Sans JP", "Noto Sans AR"],
  "formats": ["og", "twitter", "square", "linkedin", "story"],
  "templates": ["default", "social-card", "blog-hero", "email-banner"]
}
```

---

## 9. Error Reference

Every error response follows this structure:

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "details": { },
  "docs": "https://og-engine.com/api-reference/errors/#error_code"
}
```

### Error Codes

| Status | Code | Message | When |
|---|---|---|---|
| 400 | `invalid_request` | Request body is not valid JSON | Malformed request body |
| 400 | `missing_field` | Field "title" is required | Required field omitted |
| 400 | `invalid_font` | Font "Comic Sans" is not available. See GET /health for available fonts. | Unknown font name |
| 400 | `invalid_format` | Format "instagram" is not supported. Options: og, twitter, square, linkedin, story | Unknown format |
| 400 | `invalid_file` | Background image must be JPEG, PNG, or WebP under 5MB | Bad file upload |
| 401 | `unauthorized` | Missing API key. Include `Authorization: Bearer oge_sk_...` header. | No auth header |
| 401 | `unauthorized` | Invalid API key. | Key not found |
| 401 | `unauthorized` | API key has been deactivated. | Disabled key |
| 403 | `plan_required` | WebP output requires Starter plan or above. Upgrade at https://og-engine.com/#pricing | Feature gated by plan |
| 429 | `rate_limited` | Monthly limit reached (500/500 used). Resets on 2026-05-01. | Quota exhausted |
| 500 | `server_error` | Internal server error. | Unexpected failure |

**Rate limit headers** (included on every authenticated response):

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Monthly call limit for current plan |
| `X-RateLimit-Remaining` | Calls remaining this period |
| `X-RateLimit-Reset` | ISO 8601 timestamp when counter resets |

---

## 10. SDK

### Installation

```bash
npm install og-engine-sdk    # or bun add / pnpm add
```

### Client Initialization

```typescript
import { OGEngine } from 'og-engine-sdk'

const og = new OGEngine('oge_sk_...')
// or
const og = new OGEngine(process.env.OG_ENGINE_API_KEY!)
```

### Methods

**`og.render(options)`** — Generate a single image, returns `Buffer`.

```typescript
const image = await og.render({
  format: 'og',
  title: 'My Article Title',
  description: 'A short description.',
  style: { accent: '#38ef7d', font: 'Outfit' },
})
```

**`og.validate(options)`** — Check text fit, returns JSON.

```typescript
const result = await og.validate({
  format: 'og',
  title: 'Some very long headline...',
})
// result.fits === true
// result.title.lines === 2
```

**`og.batch(items)`** — Render multiple images, returns `Map<number, Buffer>`.

```typescript
const images = await og.batch([
  { format: 'og', title: 'Post 1' },
  { format: 'twitter', title: 'Post 2' },
])
```

**`og.usage()`** — Check current usage, returns JSON.

```typescript
const usage = await og.usage()
// { plan: 'starter', calls_used: 342, calls_limit: 10000, ... }
```

### SDK Behavior

- Automatic `Authorization: Bearer` header on all requests
- Automatic retry on 5xx errors (1 retry, 500ms backoff)
- TypeScript types for all request/response shapes
- Throws typed errors for 4xx responses

### Framework Integrations

Copy-paste-ready integration files for:

- **Next.js App Router** — `app/api/og/[slug]/route.ts`
- **Astro** — `src/pages/og/[slug].ts`
- **Express** — middleware function
- **Cloudflare Worker** — fetch handler

Each is a complete, runnable file with comments explaining every line.

---

## 11. Templates Gallery

A visual page. For each of the 4 templates:

- **Name + one-line description**
- **Visual preview** — rendered by the playground component at all 5 formats
- **Best for** — use case recommendation
- **Config example** — minimal JSON to use this template
- **Style options** — which style fields have the most impact

### Templates

| Template | Description | Best For |
|---|---|---|
| `default` | Accent bar, grid background, tag pill | Blog posts, documentation, general purpose |
| `social-card` | Large centered title, minimal decoration | Social media shares, announcements |
| `blog-hero` | Background image focused, text overlay at bottom | Articles with cover images, photography |
| `email-banner` | Horizontal layout, CTA-style | Email headers, newsletters, promotions |

Layout: card grid. Click a template card to expand to full preview with editable playground.

---

## 12. Fonts

### Available Fonts

| Font | API Name | Script Support | Weights | Vibe |
|---|---|---|---|---|
| Outfit | `"Outfit"` | Latin | 400, 700, 800 | Modern geometric, clean |
| Inter | `"Inter"` | Latin | 400, 700, 800 | Neutral, UI-friendly |
| Playfair Display | `"Playfair Display"` | Latin | 400, 700, 800 | Elegant serif |
| Sora | `"Sora"` | Latin | 400, 700, 800 | Rounded, friendly |
| Space Grotesk | `"Space Grotesk"` | Latin | 400, 700 | Techy, developer-friendly |
| JetBrains Mono | `"JetBrains Mono"` | Latin | 400, 700 | Monospace, code-style |
| Noto Sans JP | `"Noto Sans JP"` | Latin + CJK (Japanese) | 400, 700 | Japanese support |
| Noto Sans Arabic | `"Noto Sans AR"` | Latin + Arabic | 400, 700 | Arabic/RTL support |

Each font displayed with:
- Specimen preview (the font name rendered in itself, at multiple sizes)
- Character support badges (Latin, CJK, Arabic, Emoji)
- The exact `style.font` string to use in API calls

CJK and Arabic support is a differentiator vs competitors — called out prominently.

---

## 13. Self-Hosting (Docker)

### Dockerfile Reference

Standard multi-stage Bun Dockerfile. Environment variables:

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | Server port (default: 3000) |
| `FONTS_DIR` | no | Custom font directory (default: bundled fonts) |

### Quick Start

```bash
docker run -p 3000:3000 ghcr.io/xxx/og-engine:latest
```

### Docker Compose

```yaml
services:
  og-engine:
    image: ghcr.io/xxx/og-engine:latest
    ports:
      - "3000:3000"
    volumes:
      - ./fonts:/app/fonts    # Optional: custom fonts
    restart: unless-stopped
```

### Cloud Deployment

**Fly.io (3 commands):**

```bash
fly launch --name og-engine
fly secrets set STRIPE_SECRET_KEY=sk_live_xxx  # Only for managed version
fly deploy
```

**Railway:** One-click deploy button in README.

### Health Check

```bash
curl http://localhost:3000/health
```

Page ends with: "For managed hosting with zero ops, see [Pricing](/pricing)."

---

## 14. Pricing & Limits

| | Free | Starter | Pro | Scale |
|---|---|---|---|---|
| **Price** | 0 | 10/mo | 39/mo | 99/mo |
| **Renders/month** | 500 | 10,000 | 50,000 | 200,000 |
| **Formats** | All 5 | All 5 | All 5 | All 5 |
| **Templates** | All 4 | All 4 | All 4 | All 4 |
| **Output** | PNG | PNG + WebP | PNG + WebP | PNG + WebP |
| **Batch** | — | — | Up to 100 | Up to 100 |
| **CDN cache** | — | — | Included | Included |
| **Support** | Community | Email | Priority email | Dedicated |

### How Rate Limiting Works

- Monthly counter, resets on billing cycle (Stripe `invoice.paid` webhook)
- Free tier resets on the 1st of each month
- When limit reached: HTTP 429 with `rate_limited` error + upgrade URL
- Rate limit headers on every authenticated response

### FAQ

- **Can I upgrade mid-cycle?** Yes. Upgrade is immediate, counter resets, new limit applies.
- **Is unused quota rolled over?** No. Quota resets each billing cycle.
- **What counts as a render?** Each call to POST /render = 1 render. Each item in a batch = 1 render. Validate calls are free and unlimited.
- **Can I downgrade?** Yes. Downgrade takes effect at the next billing cycle.

---

## 15. Changelog

Reverse-chronological. Format:

```
## v0.1.0 — 2026-04-XX

### Added
- POST /render — generate images from JSON (PNG output)
- POST /validate — check if text fits a layout (free, unlimited)
- POST /render/batch — bulk image generation (Pro+)
- GET /health — discover fonts, formats, templates
- 4 templates: default, social-card, blog-hero, email-banner
- 5 formats: og, twitter, square, linkedin, story
- 8 bundled fonts including CJK (Noto Sans JP) and Arabic (Noto Sans AR)
- TypeScript SDK with render(), validate(), batch(), usage()
- Docker image for self-hosting
- Interactive playground in docs
```

Updated with every release. New features link to relevant docs pages.

---

## 16. Interactive Playground

The centerpiece — turns docs into a conversion tool.

### Architecture

Runs **entirely client-side** using Canvas, ported from the POC (`docs/analysis/og-engine.jsx`). No API calls needed.

- Works before the API exists
- Zero latency — renders on every keystroke
- No auth required — visitors play freely, then sign up when convinced

When the real API ships, add a toggle: "Client preview" <-> "Live API" (requires key).

### Three Contexts

**1. Mini Playground (Home page)**

- Compact: title input + description input + image preview
- Fixed to `og` format, `default` template
- Purpose: instant wow factor

**2. Contextual Playground (Guide pages & API Reference)**

- Pre-configured for the topic of that page
- Example: "Background Images" guide has image URL field + overlay slider
- Example: `POST /render` reference has full JSON editor -> image preview + simulated response headers
- Purpose: learn by doing

**3. Full Playground (standalone page at `/playground`)**

All controls exposed:

- **Left panel (controls):**
  - Format selector (og, twitter, square, linkedin, story)
  - Template selector with visual thumbnails
  - Title + description + author + tag inputs
  - Style panel: accent color picker, font dropdown, title/desc size sliders, layout toggle, gradient picker
  - Background image URL input + overlay opacity slider
  - Output format toggle (PNG/WebP)

- **Right panel (preview):**
  - Live Canvas rendering
  - Simulated response headers (`X-Render-Time-Ms`, `X-Title-Lines`, etc.)

- **Below the preview:**
  - "Copy as curl" button — generates the equivalent API request
  - "Copy as SDK" button — generates the TypeScript SDK code
  - "Download PNG" button — exports directly from Canvas

### Technical Implementation

Components in `src/components/`:

| File | Purpose |
|---|---|
| `Playground.tsx` | Full standalone playground |
| `PlaygroundMini.tsx` | Compact home page version |
| `PlaygroundContextual.tsx` | Configurable for guide/reference pages |
| `engine/canvas-renderer.ts` | POC Canvas rendering logic, ported to TypeScript |
| `engine/text-measure.ts` | `measureLines()` from POC |
| `engine/fonts.ts` | Google Fonts CDN loading on demand |
| `engine/gradients.ts` | 6 gradient presets (Void, Deep Sea, Ember, Forest, Plum, Slate) |
| `engine/formats.ts` | Format dimensions + line constraints |
| `ui/JsonEditor.tsx` | Editable JSON panel for API reference |
| `ui/StyleControls.tsx` | Color picker, sliders, dropdowns |
| `ui/FormatSelector.tsx` | Format cards with dimensions |
| `ui/TemplateSelector.tsx` | Template visual thumbnails |
| `ui/CodeOutput.tsx` | curl/SDK code generation from current config |

All playground components use Astro's `client:visible` directive — they hydrate only when scrolled into view.

### Fonts in the Playground

Loaded from Google Fonts CDN on demand (only when selected). The 8 fonts match the server-side fonts, ensuring the playground preview matches real API output.

---

## 17. Starlight Configuration

### `astro.config.mjs`

```javascript
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'

export default defineConfig({
  integrations: [
    starlight({
      title: 'OG Engine',
      tagline: 'Generate images in 2ms. No browser required.',
      logo: { src: './src/assets/logo.svg' },
      social: { github: 'https://github.com/xxx/og-engine' },
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
        { label: 'Pricing & Limits', link: '/pricing/' },
        { label: 'Changelog', link: '/changelog/' },
      ],
    }),
    react(),
  ],
})
```

### Custom Styling (`src/styles/custom.css`)

- Dark mode only (no light mode toggle)
- Accent color: `#38ef7d`
- Body font: Inter
- Code font: JetBrains Mono
- Code blocks: dark background matching the "void" gradient (`#0c0f1a`)
- Subtle green glow on hover states and active sidebar items
- Custom hero section styling for the home page

---

## 18. Design Principles

Applied across every page:

1. **Show, don't tell** — every concept has a visual or code example
2. **Progressive disclosure** — curl first, SDK second, advanced config third
3. **Copy-paste friendly** — every code block has a copy button, every example is complete and runnable
4. **Response headers visible** — always show `X-Render-Time-Ms` and metadata headers alongside examples, reinforcing the speed narrative
5. **No dead ends** — every page ends with "Next steps" pointing to the logical next page
6. **One question per page** — each page answers one question completely rather than half-answering many

---

## 19. OpenAPI Spec Structure

Hand-written `public/openapi.json` following OpenAPI 3.1:

```
openapi: 3.1.0
info:
  title: OG Engine API
  version: 0.1.0
  description: Server-side image generation API. 2ms renders, zero browser.

servers:
  - url: https://api.og-engine.com (Production)
  - url: http://localhost:3000 (Local / Self-hosted)

security:
  - BearerAuth: []

paths:
  POST /render         — full request/response schemas
  POST /validate       — no auth, free
  POST /render/batch   — Pro+ restriction
  GET  /health         — public, no auth

components:
  securitySchemes:
    BearerAuth (http, bearer)
  schemas:
    RenderRequest      — all fields with types, defaults, enums, min/max
    RenderStyle        — nested style object
    RenderOutput       — nested output object
    ValidateRequest    — all validate fields
    ValidateResponse   — fits, title, description, computeTimeMs
    BatchRequest       — { items: RenderRequest[] }
    HealthResponse     — status, version, fonts[], formats[], templates[]
    ErrorResponse      — { error, message, details, docs }
```

Every schema includes `type`, `required`, `default`, `description`, `enum`, `example`, `minimum`/`maximum` where applicable. The spec is self-contained and importable into Swagger UI or Postman.

---

## 20. Scope & Non-Goals

### In Scope (this spec)

- Complete Starlight documentation site
- All content pages (home, quick start, 7 guides, 6 API reference pages, SDK, templates, fonts, self-hosting, pricing, changelog)
- Interactive playground (3 variants: mini, contextual, full)
- OpenAPI 3.1 spec
- Custom dark theme with OG Engine branding
- Client-side Canvas rendering engine (ported from POC)

### Not In Scope

- The API server itself (separate implementation plan)
- Landing page / marketing site (separate from docs, though docs serve as marketing)
- Stripe integration / monetization code
- CI/CD pipeline for docs deployment
- Analytics / tracking on the docs site
- i18n / translations
- Search customization beyond Starlight's built-in Pagefind
