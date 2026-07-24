# Marketing Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 10 marketing improvements to the OG Engine documentation site, aligning it with the product analysis documents (GO-TO-MARKET.md, DECISIONS.md, FEATURES-IDEAS.md) to improve conversion, SEO, and user acquisition.

**Architecture:** All changes are content additions (`.mdx` files) and CSS styling in the existing Astro Starlight docs site. New pages are added to the sidebar in `astro.config.mjs`. No backend or API changes.

**Tech Stack:** Astro Starlight, MDX, CSS, React components (existing playground infrastructure)

---

## File Map

### New Files
- `src/content/docs/compare/puppeteer.mdx` — Competitive positioning page (Task 1)
- `src/content/docs/guides/nextjs.mdx` — Next.js integration guide (Task 4)
- `src/content/docs/guides/astro.mdx` — Astro integration guide (Task 4)
- `src/content/docs/guides/cloudflare-workers.mdx` — CF Workers guide (Task 4)
- `src/content/docs/blog/index.mdx` — Blog index (Task 5)
- `src/content/docs/blog/why-we-built-og-engine.mdx` — Launch article 1 (Task 5)
- `src/content/docs/blog/how-pretext-measures-text.mdx` — Launch article 2 (Task 5)
- `src/content/docs/blog/multilingual-og-images.mdx` — Launch article 3 (Task 5)

### Modified Files
- `src/content/docs/index.mdx` — Add use cases, social proof, FAQ, how-it-works, validate hook (Tasks 2, 3, 6, 8)
- `src/content/docs/pricing.mdx` — Add plan persona descriptions (Task 7)
- `src/content/docs/changelog.mdx` — Add marketing-oriented content (Task 10)
- `src/styles/custom.css` — Add styles for new homepage sections, blog, compare page (Tasks 2, 3, 5, 8, 9)
- `astro.config.mjs` — Add new sidebar entries (Tasks 1, 4, 5, 9)

---

### Task 1: Competitive Positioning Page (`/compare/puppeteer/`)

**Files:**
- Create: `docs/site/src/content/docs/compare/puppeteer.mdx`
- Modify: `docs/site/astro.config.mjs`

- [ ] **Step 1: Create the comparison page**

Create `docs/site/src/content/docs/compare/puppeteer.mdx`:

```mdx
---
title: OG Engine vs Puppeteer
description: Side-by-side comparison of OG Engine and Puppeteer for image generation. Performance, cost, architecture, and migration guide.
---

If you're using Puppeteer, Playwright, or any headless browser to generate OG images, social cards, or email banners — this page is for you.

## Architecture Comparison

| | Puppeteer / Playwright | OG Engine |
|---|---|---|
| **How it works** | Launches full Chrome, loads HTML/CSS, screenshots viewport | Measures text with Pretext, draws directly to Canvas |
| **Runtime** | Chrome binary + Xvfb + sandbox + Node.js | Node.js (or Bun) only |
| **Text rendering** | Full browser layout engine (Blink) | Pretext: Unicode-aware segmentation + Canvas |
| **Output** | Screenshot of browser viewport | Canvas → PNG / WebP |
| **Languages** | All (full browser) | All — CJK, Arabic, emoji, bidirectional |
| **Fonts** | System fonts or network fetch | Pre-loaded .ttf files (8 families, zero latency) |

## Performance

| Metric | Puppeteer | OG Engine | Improvement |
|---|---|---|---|
| **Render time** | ~850ms | **~2ms** | 425x faster |
| **Memory per render** | 200–500 MB | **~10 MB** | 20–50x less |
| **Concurrency per instance** | 5–10 | **500+** | 50–100x more |
| **Cold start** | 2–5 seconds | **~50ms** | 40–100x faster |
| **CPU per render** | High (full layout + paint) | **Minimal** (text measure + draw) | ~10x less |

## Infrastructure Cost

For 50,000 images/month:

| | Puppeteer (self-hosted) | OG Engine (hosted) | OG Engine (self-hosted) |
|---|---|---|---|
| **Compute** | 2–4 vCPU, 4–8 GB RAM | — | 1 vCPU, 512 MB RAM |
| **Monthly cost** | ~$40–100 (cloud VM) | €39 (Pro plan) | ~$5–10 (container) |
| **Maintenance** | Chrome updates, Xvfb, sandboxing, crash recovery | Zero | Docker image updates |
| **Scaling** | Manual (add instances, load balance) | Automatic | Manual |

## What You Lose

OG Engine is **not** a general-purpose browser renderer. It generates images from structured text data. You cannot:

- Render arbitrary HTML/CSS
- Execute JavaScript in a browser context
- Screenshot existing web pages
- Use browser-specific APIs (DOM, CSSOM)

If you need full HTML rendering, keep Puppeteer. If you need **text-on-image generation** (OG cards, social images, email banners), OG Engine is 425x faster and dramatically simpler.

## Migration Guide

### Before (Puppeteer)

```typescript
import puppeteer from 'puppeteer'

const browser = await puppeteer.launch()
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630 })
await page.setContent(`
  <html>
    <body style="background: #0a0a0a; color: white; font-family: sans-serif; padding: 60px;">
      <h1 style="font-size: 48px;">My Blog Post Title</h1>
      <p style="font-size: 22px; color: #888;">A description that renders in a real browser.</p>
    </body>
  </html>
`)
const screenshot = await page.screenshot({ type: 'png' })
await browser.close()
```

### After (OG Engine)

```typescript
import { OGEngine } from '@atypical-consulting/og-engine-sdk'

const og = new OGEngine(process.env.OG_ENGINE_KEY)

const image = await og.render({
  format: 'og',
  title: 'My Blog Post Title',
  description: 'A description that renders without a browser.',
  style: { accent: '#38ef7d', font: 'Outfit', layout: 'left' },
})
```

### After (curl)

```bash
curl -X POST https://api.og-engine.com/render \
  -H "Authorization: Bearer $OG_ENGINE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"format":"og","title":"My Blog Post Title","description":"A description that renders without a browser."}' \
  --output og.png
```

### Migration Checklist

1. **Sign up** — `POST /auth/register` with your email (free, no credit card)
2. **Map your HTML to JSON** — title, description, tag, author, style (accent, font, layout)
3. **Replace the Puppeteer call** with `og.render()` or a curl to `/render`
4. **Remove Chrome dependencies** — uninstall `puppeteer`, remove Xvfb from Dockerfile, drop `--no-sandbox` flags
5. **Test with `/validate`** — free, unlimited — check that your text fits before rendering

## When to Use Each

| Use Case | Puppeteer | OG Engine |
|---|---|---|
| OG / social card images | Overkill | **Best fit** |
| Email banners | Slow, complex | **Best fit** |
| Blog hero images | Slow | **Best fit** |
| Dynamic ad creatives | Possible | **Best fit** |
| Screenshot existing pages | **Only option** | Not supported |
| Full HTML rendering | **Only option** | Not supported |
| PDF generation from HTML | **Only option** | Not supported |
```

- [ ] **Step 2: Add sidebar entry in astro.config.mjs**

In `docs/site/astro.config.mjs`, add a new sidebar section before "Pricing & Limits":

```javascript
{
  label: 'Compare',
  items: [
    { label: 'OG Engine vs Puppeteer', link: '/compare/puppeteer/' },
  ],
},
```

- [ ] **Step 3: Verify the page renders**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/compare/puppeteer.mdx docs/site/astro.config.mjs
git commit -m "feat(docs): add competitive positioning page — OG Engine vs Puppeteer"
```

---

### Task 2: Port Missing Homepage Sections from landing-page.jsx

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Add "How It Works" section to index.mdx**

After the "Benchmarks" section and before "Live Render", add:

```mdx
## How It Works

<div class="how-it-works">
<div class="step">
<div class="step-number">1</div>
<div class="step-content">
<h3>Send JSON</h3>
<p>POST your title, description, format, and style to <code>/render</code>.</p>
</div>
</div>
<div class="step">
<div class="step-number">2</div>
<div class="step-content">
<h3>Text Layout</h3>
<p>Pretext measures every glyph — CJK, Arabic, emoji — and computes line breaks in microseconds.</p>
</div>
</div>
<div class="step">
<div class="step-number">3</div>
<div class="step-content">
<h3>Canvas Render</h3>
<p>Background, gradients, text, and decorations are composited directly onto a Canvas. No DOM, no browser.</p>
</div>
</div>
<div class="step">
<div class="step-number">4</div>
<div class="step-content">
<h3>Get Your Image</h3>
<p>PNG or WebP binary in the response. Typical render: 2ms. Headers tell you line count and overflow status.</p>
</div>
</div>
</div>
```

- [ ] **Step 2: Add FAQ section to index.mdx**

After the "Formats" table at the bottom of index.mdx, add:

```mdx
---

## FAQ

<div class="home-faq">

### How is this so fast?

OG Engine uses [Pretext](https://github.com/chenglou/pretext) for text measurement — the same Unicode segmentation engine, running server-side with Canvas. No browser startup, no DOM layout, no paint cycle. Just math and pixels.

### Does it handle non-Latin scripts?

Yes. Pretext handles CJK (Chinese, Japanese, Korean), Arabic (with bidirectional text), emoji, grapheme clusters, and mixed-script content. Pre-loaded fonts include Noto Sans JP and Noto Sans AR.

### Can I validate text without generating an image?

Yes. `POST /validate` checks if your text fits a layout — free, unlimited, no authentication required. Use it to catch overflow before rendering.

### Is there a free plan?

Yes. 500 renders/month, forever. No credit card, no expiration. Same engine, same speed, same quality as paid plans.

### Can I self-host?

Yes. OG Engine ships as an open-source Docker image. Run it on your own infrastructure with zero per-render cost. See [Self-Hosting](/self-hosting/docker/).

### What about custom templates?

Scale plan (€99/mo) supports custom JSON templates. All plans get 4 built-in templates. A visual template builder is on the roadmap.

</div>
```

- [ ] **Step 3: Add CSS styles for new sections**

Append to `docs/site/src/styles/custom.css`:

```css
/* ─── How It Works Section ─── */
.how-it-works {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  margin: 2rem 0;
}

@media (max-width: 768px) {
  .how-it-works {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 480px) {
  .how-it-works {
    grid-template-columns: 1fr;
  }
}

.how-it-works .step {
  border: 1px solid var(--og-border);
  background: var(--og-surface);
  border-radius: 6px;
  padding: 1.25rem;
  transition: border-color 0.2s ease;
}

.how-it-works .step:hover {
  border-color: var(--og-glow-medium);
}

.how-it-works .step-number {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 1.5rem;
  color: var(--og-glow);
  opacity: 0.5;
  margin-bottom: 0.5rem;
}

.how-it-works .step h3 {
  font-family: 'Syne', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0 0 0.4rem;
  color: var(--sl-color-white);
}

.how-it-works .step p {
  font-size: 0.82rem;
  color: var(--sl-color-gray-2);
  margin: 0;
  line-height: 1.5;
}

/* ─── Home FAQ Section ─── */
.home-faq h3 {
  font-size: 1rem;
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
  color: var(--sl-color-white);
}

.home-faq p {
  color: var(--sl-color-gray-1);
  font-size: 0.9rem;
}
```

- [ ] **Step 4: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(docs): add How It Works and FAQ sections to homepage"
```

---

### Task 3: Use-Case Personas on Homepage

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Add use cases section to index.mdx**

After the "How It Works" section and before "Live Render", insert:

```mdx
## Who Uses OG Engine

<div class="use-cases">
<div class="use-case">
<div class="use-case-icon">{ }</div>
<h3>Blog Platforms</h3>
<p>Auto-generate unique OG images for every post. No design tool, no template editor — just your title and brand colors.</p>
</div>
<div class="use-case">
<div class="use-case-icon">~></div>
<h3>SaaS Products</h3>
<p>Dynamic social cards when users share dashboards, reports, or public pages. Render on demand, cache at the edge.</p>
</div>
<div class="use-case">
<div class="use-case-icon">$</div>
<h3>E-Commerce</h3>
<p>Product images with price overlays, sale badges, and localized text — generated at scale for every SKU.</p>
</div>
<div class="use-case">
<div class="use-case-icon">@</div>
<h3>Email Marketing</h3>
<p>Personalized banners with recipient name, offer details, or dynamic content. No design bottleneck.</p>
</div>
</div>
```

- [ ] **Step 2: Add CSS for use cases**

Append to `docs/site/src/styles/custom.css`:

```css
/* ─── Use Cases Section ─── */
.use-cases {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
  margin: 2rem 0;
}

@media (max-width: 520px) {
  .use-cases {
    grid-template-columns: 1fr;
  }
}

.use-case {
  border: 1px solid var(--og-border);
  background: var(--og-surface);
  border-radius: 6px;
  padding: 1.5rem;
  transition: border-color 0.2s ease;
}

.use-case:hover {
  border-color: var(--og-glow-medium);
}

.use-case-icon {
  font-family: var(--sl-font-mono);
  font-size: 1.25rem;
  color: var(--og-glow);
  opacity: 0.6;
  margin-bottom: 0.75rem;
}

.use-case h3 {
  font-family: 'Syne', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.4rem;
  color: var(--sl-color-white);
}

.use-case p {
  font-size: 0.85rem;
  color: var(--sl-color-gray-2);
  margin: 0;
  line-height: 1.5;
}
```

- [ ] **Step 3: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(docs): add use-case personas section to homepage"
```

---

### Task 4: Framework-Specific Integration Guides

**Files:**
- Create: `docs/site/src/content/docs/guides/nextjs.mdx`
- Create: `docs/site/src/content/docs/guides/astro.mdx`
- Create: `docs/site/src/content/docs/guides/cloudflare-workers.mdx`
- Modify: `docs/site/astro.config.mjs`

- [ ] **Step 1: Create Next.js guide**

Create `docs/site/src/content/docs/guides/nextjs.mdx`:

```mdx
---
title: OG Images in Next.js
description: Generate dynamic OG images in Next.js App Router with OG Engine — 2ms renders, zero browser dependencies.
---

Add dynamic Open Graph images to your Next.js app in under 5 minutes. Works with App Router and Pages Router.

## Install the SDK

```bash
npm install @atypical-consulting/og-engine-sdk
```

## App Router — Route Handler

Create `app/api/og/route.ts`:

```typescript
import { OGEngine } from '@atypical-consulting/og-engine-sdk'

const og = new OGEngine(process.env.OG_ENGINE_KEY!)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'My Site'
  const description = searchParams.get('description') ?? ''

  const image = await og.render({
    format: 'og',
    title,
    description,
    style: {
      accent: '#38ef7d',
      font: 'Outfit',
      layout: 'left',
    },
  })

  return new Response(image, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
```

## Add the Meta Tag

In your layout or page:

```typescript
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(post.excerpt)}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  }
}
```

## Validate Before Rendering

Use `/validate` to check text fits before paying for a render:

```typescript
const check = await og.validate({
  format: 'og',
  title: post.title,
  description: post.excerpt,
})

if (!check.fits) {
  // Truncate or adjust text
}
```

## Environment Setup

Add to `.env.local`:

```
OG_ENGINE_KEY=oge_sk_your_key_here
```

> **Important:** Only use the SDK in server-side code (Route Handlers, Server Components, `getServerSideProps`). Never expose your API key to the browser.

## Caching Strategy

The route handler above sets a 24-hour cache. For static sites, consider generating images at build time:

```typescript
// scripts/generate-og.ts
import { OGEngine } from '@atypical-consulting/og-engine-sdk'
import { writeFile } from 'fs/promises'

const og = new OGEngine(process.env.OG_ENGINE_KEY!)
const posts = await getAllPosts()

for (const post of posts) {
  const image = await og.render({
    format: 'og',
    title: post.title,
    description: post.excerpt,
  })
  await writeFile(`public/og/${post.slug}.png`, image)
}
```
```

- [ ] **Step 2: Create Astro guide**

Create `docs/site/src/content/docs/guides/astro.mdx`:

```mdx
---
title: OG Images in Astro
description: Generate dynamic OG images in Astro with OG Engine — 2ms renders, zero browser dependencies.
---

Add dynamic Open Graph images to your Astro site. Works with both static and SSR modes.

## Install the SDK

```bash
npm install @atypical-consulting/og-engine-sdk
```

## API Route (SSR Mode)

Create `src/pages/api/og.ts`:

```typescript
import type { APIRoute } from 'astro'
import { OGEngine } from '@atypical-consulting/og-engine-sdk'

const og = new OGEngine(import.meta.env.OG_ENGINE_KEY)

export const GET: APIRoute = async ({ url }) => {
  const title = url.searchParams.get('title') ?? 'My Site'
  const description = url.searchParams.get('description') ?? ''

  const image = await og.render({
    format: 'og',
    title,
    description,
    style: { accent: '#38ef7d', font: 'Outfit', layout: 'left' },
  })

  return new Response(image, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
```

## Add to Page Frontmatter

```astro
---
// src/pages/blog/[slug].astro
const { slug } = Astro.params
const post = await getPost(slug)

const ogUrl = `/api/og?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(post.excerpt)}`
---

<html>
<head>
  <meta property="og:image" content={ogUrl} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
</head>
```

## Static Build (Pre-generate at Build Time)

For fully static sites, generate images during `astro build`:

```typescript
// scripts/generate-og.ts
import { OGEngine } from '@atypical-consulting/og-engine-sdk'
import { writeFile } from 'fs/promises'
import { getCollection } from 'astro:content'

const og = new OGEngine(import.meta.env.OG_ENGINE_KEY)
const posts = await getCollection('blog')

for (const post of posts) {
  const image = await og.render({
    format: 'og',
    title: post.data.title,
    description: post.data.description,
  })
  await writeFile(`public/og/${post.slug}.png`, image)
}
```

## Environment Setup

Add to `.env`:

```
OG_ENGINE_KEY=oge_sk_your_key_here
```

Access with `import.meta.env.OG_ENGINE_KEY` in server-side code.
```

- [ ] **Step 3: Create Cloudflare Workers guide**

Create `docs/site/src/content/docs/guides/cloudflare-workers.mdx`:

```mdx
---
title: OG Images on Cloudflare Workers
description: Generate OG images at the edge with OG Engine and Cloudflare Workers — sub-5ms API calls from 300+ locations.
---

Deploy an OG image endpoint to Cloudflare Workers. Your images render in 2ms on OG Engine's servers, and Cloudflare's edge cache serves repeat requests in under 1ms worldwide.

## Install the SDK

```bash
npm install @atypical-consulting/og-engine-sdk
```

## Worker Code

Create `src/index.ts`:

```typescript
import { OGEngine } from '@atypical-consulting/og-engine-sdk'

export interface Env {
  OG_ENGINE_KEY: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname !== '/og') {
      return new Response('Not found', { status: 404 })
    }

    const title = url.searchParams.get('title') ?? 'My Site'
    const description = url.searchParams.get('description') ?? ''

    const og = new OGEngine(env.OG_ENGINE_KEY)

    const image = await og.render({
      format: 'og',
      title,
      description,
      style: { accent: '#38ef7d', font: 'Outfit', layout: 'left' },
    })

    return new Response(image, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  },
}
```

## Environment Setup

```bash
wrangler secret put OG_ENGINE_KEY
```

## Deploy

```bash
wrangler deploy
```

## Edge Caching

Cloudflare automatically caches responses with `Cache-Control` headers. Repeat requests for the same title + description are served from the edge — zero API calls, zero render cost.

For cache busting, add a version parameter:

```
/og?title=Hello&v=2
```

## Validate at the Edge

Use `/validate` to check text fits without consuming renders. It's free and requires no authentication:

```typescript
const check = await og.validate({
  format: 'og',
  title,
  description,
})

if (!check.fits) {
  // Fallback to shorter title
}
```
```

- [ ] **Step 4: Add sidebar entries in astro.config.mjs**

In the `Guides` section of the sidebar, add these three entries after the existing guides:

```javascript
{ label: 'Next.js Integration', link: '/guides/nextjs/' },
{ label: 'Astro Integration', link: '/guides/astro/' },
{ label: 'Cloudflare Workers', link: '/guides/cloudflare-workers/' },
```

- [ ] **Step 5: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add docs/site/src/content/docs/guides/nextjs.mdx docs/site/src/content/docs/guides/astro.mdx docs/site/src/content/docs/guides/cloudflare-workers.mdx docs/site/astro.config.mjs
git commit -m "feat(docs): add framework integration guides for Next.js, Astro, Cloudflare Workers"
```

---

### Task 5: Blog Infrastructure + 3 Launch Articles

**Files:**
- Create: `docs/site/src/content/docs/blog/index.mdx`
- Create: `docs/site/src/content/docs/blog/why-we-built-og-engine.mdx`
- Create: `docs/site/src/content/docs/blog/how-pretext-measures-text.mdx`
- Create: `docs/site/src/content/docs/blog/multilingual-og-images.mdx`
- Modify: `docs/site/astro.config.mjs`

- [ ] **Step 1: Create blog index page**

Create `docs/site/src/content/docs/blog/index.mdx`:

```mdx
---
title: Blog
description: Engineering deep-dives, launch updates, and guides from the OG Engine team.
---

Articles from the OG Engine team on image generation, text rendering, and killing headless browsers.

---

### [Why We Built OG Engine](/blog/why-we-built-og-engine/)
*April 2026* — The problem with headless Chrome for image generation, and how Pretext changes the equation.

### [How Pretext Measures Text Without a Browser](/blog/how-pretext-measures-text/)
*April 2026* — A technical deep-dive into Unicode segmentation, line breaking, and sub-millisecond text layout.

### [Multilingual OG Images: CJK, Arabic, and Emoji](/blog/multilingual-og-images/)
*April 2026* — Why most OG image generators fail at non-Latin scripts, and how OG Engine handles them natively.
```

- [ ] **Step 2: Create article 1 — "Why We Built OG Engine"**

Create `docs/site/src/content/docs/blog/why-we-built-og-engine.mdx`:

```mdx
---
title: Why We Built OG Engine
description: The problem with headless Chrome for image generation, and how Pretext changes the equation.
---

Every SaaS product needs OG images. The standard approach — Puppeteer, headless Chrome, screenshot a rendered HTML page — works. But it's absurdly expensive for what it does.

## The Puppeteer Problem

To generate a 1200x630 PNG with some text on a gradient, the typical stack:

1. **Launches a full Chrome browser** (~200MB memory)
2. **Loads a complete HTML document** with CSS parsing, DOM construction, layout
3. **Paints pixels** through Blink's rendering pipeline — designed for interactive web pages
4. **Screenshots the viewport** and encodes to PNG
5. **Kills the browser** (or pools it, adding connection management complexity)

This takes ~850ms per image. At 50,000 images/month, you need multiple instances, crash recovery, Xvfb for headless rendering, and Chrome security sandboxing. Infrastructure cost alone runs $40–100/month before you write a line of application code.

For rendering text on a background — which is 95% of OG image use cases — this is like driving a semi truck to pick up a letter from the mailbox.

## What Pretext Changes

[Pretext](https://github.com/chenglou/pretext) is a JavaScript text measurement engine built by Cheng Lou. It handles:

- **Unicode segmentation** — correctly identifies grapheme clusters, word boundaries, and line break opportunities
- **Bidirectional text** — Arabic, Hebrew, and mixed-direction content
- **CJK line breaking** — Chinese, Japanese, Korean text wrapping rules
- **Emoji handling** — multi-codepoint emoji sequences treated as single glyphs

Pretext computes exact text layout — line breaks, heights, overflow — without a browser. The measurement step that takes Chrome 200ms+ takes Pretext under 0.1ms.

## The Architecture

OG Engine combines Pretext with server-side Canvas rendering:

1. **Pretext measures text** — computes line breaks, line count, total height (< 0.1ms)
2. **Canvas draws the image** — gradient, grid pattern, accent bar, text, decorations (< 2ms)
3. **PNG encode** — Canvas to binary (< 1ms)

Total: **2–5ms per image**. No browser, no DOM, no Xvfb. A single Node.js process handles 500+ concurrent renders.

## The Numbers

| | Puppeteer | OG Engine |
|---|---|---|
| Render | ~850ms | ~2ms |
| Memory | ~200–500MB | ~10MB |
| Concurrency | 5–10/instance | 500+/instance |
| Cold start | 2–5s | ~50ms |
| Infrastructure | Chrome + Xvfb | Node.js |

At 50,000 images/month, OG Engine Pro costs €39/mo and requires zero infrastructure management. Self-hosting runs on a $5/month container.

## Who It's For

- **Blog platforms** generating OG images per post
- **SaaS products** creating social cards for shared content
- **E-commerce** producing product images with price overlays
- **Email marketing** rendering personalized banners at scale

If you're currently running Puppeteer to put text on images, you're running a browser to do canvas math. OG Engine does the canvas math directly.

## Try It

500 free renders/month. No credit card. [Get started](/quick-start/) or try the [playground](/playground/) — zero setup, instant results.
```

- [ ] **Step 3: Create article 2 — "How Pretext Measures Text"**

Create `docs/site/src/content/docs/blog/how-pretext-measures-text.mdx`:

```mdx
---
title: How Pretext Measures Text Without a Browser
description: A technical deep-dive into Unicode segmentation, line breaking, and sub-millisecond text layout.
---

When a browser renders text, it runs a multi-stage pipeline: parse HTML, resolve CSS styles, build a layout tree, break text into lines, compute positions, rasterize glyphs. This is incredibly powerful — and incredibly wasteful when all you need is "how many lines does this string occupy at 48px in Outfit font?"

Pretext answers that question in under 0.1ms.

## What Text Layout Actually Requires

To place text on a canvas, you need to know:

1. **Where to break lines** — which words go on which line given a maximum width
2. **How tall each line is** — determined by font size and line height
3. **How many lines total** — to detect overflow
4. **The content of each line** — to draw them at the correct Y positions

In a browser, this information emerges from the full CSS layout engine. Pretext computes it directly from the font metrics and Unicode rules.

## Unicode Is Hard

English text breaks on spaces. But Unicode text isn't that simple:

- **CJK text** (Chinese, Japanese, Korean) can break between any two characters, with exceptions for punctuation
- **Arabic text** is bidirectional — the string order and visual order differ, and connected letter forms change based on position
- **Emoji** can be multi-codepoint sequences: a flag emoji is two regional indicator symbols; a family emoji can be 7+ codepoints joined by zero-width joiners
- **Grapheme clusters** like "e" + combining accent mark are one visual unit but two codepoints

Pretext implements the Unicode Line Break Algorithm (UAX #14) and grapheme cluster segmentation (UAX #29) to handle all of this correctly.

## The Two-Phase API

Pretext exposes two levels of detail:

### Quick Check: `prepare()` + `layout()`

```typescript
import { prepare, layout } from '@chenglou/pretext'

const prepared = prepare(text, fontString)
const result = layout(prepared, maxWidth, lineHeight)
// result.height, result.lineCount
```

This tells you height and line count — enough for the `/validate` endpoint. Sub-0.1ms.

### Full Layout: `prepareWithSegments()` + `layoutWithLines()`

```typescript
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

const prepared = prepareWithSegments(text, fontString)
const { lines, height, lineCount } = layoutWithLines(prepared, maxWidth, lineHeight)
// lines[0].text, lines[0].width, lines[0].y
```

This returns the actual text content of each line — needed for Canvas rendering. Still under 0.5ms.

## Why Canvas, Not SVG

OG Engine uses `@napi-rs/canvas` (server-side Canvas API, backed by Skia) rather than SVG because:

- **Pixel-perfect output** — rasterized text matches exactly what social platforms display
- **Compositing** — background images, gradients, overlays, and text blend naturally
- **Performance** — Canvas draw calls are GPU-accelerated through Skia
- **Font consistency** — `@napi-rs/canvas` uses the same font rasterizer (Skia) across all platforms

The Canvas API on the server is identical to the browser Canvas API. Code from the browser prototype ported to the server with zero changes.

## Caching

Pretext's `prepare()` step (Unicode segmentation) is deterministic: the same text + font always produces the same segments. OG Engine caches prepared results in an LRU cache keyed on `(text, font)`, so repeated renders of the same text skip segmentation entirely.

## The Result

For OG Engine, this architecture means:

- **`POST /validate`** uses `prepare()` + `layout()` — answers "does it fit?" in < 0.1ms
- **`POST /render`** uses `prepareWithSegments()` + `layoutWithLines()` + Canvas draw — full image in 2–5ms
- **No browser** — no Chrome, no Xvfb, no sandbox, no crash recovery
- **No DOM** — no HTML parsing, no CSS resolution, no layout tree

Text layout without a browser. That's what Pretext enables, and that's what OG Engine is built on.
```

- [ ] **Step 4: Create article 3 — "Multilingual OG Images"**

Create `docs/site/src/content/docs/blog/multilingual-og-images.mdx`:

```mdx
---
title: "Multilingual OG Images: CJK, Arabic, and Emoji"
description: Why most OG image generators fail at non-Latin scripts, and how OG Engine handles them natively.
---

If your product serves users who write in Japanese, Arabic, Chinese, Korean, or who use emoji in titles — your OG image generator probably has bugs you haven't noticed yet.

## The Problem

Most OG image solutions use one of two approaches:

1. **HTML/CSS in headless Chrome** — works for all scripts, but costs 850ms and 200MB per render
2. **Simple Canvas text drawing** — fast, but breaks on:
   - CJK line wrapping (breaks mid-word or at wrong characters)
   - Arabic bidirectional text (renders backwards or disconnects letter forms)
   - Emoji sequences (splits multi-codepoint emoji into broken symbols)
   - Mixed scripts (Japanese + English in one title)

OG Engine handles all of these correctly because it uses Pretext for text segmentation rather than naive string splitting.

## CJK: Chinese, Japanese, Korean

CJK text doesn't use spaces between words. Line breaking follows specific rules:

- **Can break** between most CJK characters
- **Cannot break** before punctuation like `。`, `、`, `)`, `」`
- **Cannot break** after opening punctuation like `(`, `「`
- **Mixed text** (CJK + Latin) requires break opportunities at script boundaries

OG Engine ships with **Noto Sans JP** pre-loaded, covering all CJK Unified Ideographs, Hiragana, and Katakana.

### Example

```json
{
  "format": "og",
  "title": "サーバーサイドの画像生成 — ブラウザ不要",
  "description": "Pretextエンジンによる高速テキストレイアウト。2msでPNG生成。",
  "style": { "font": "Noto Sans JP" }
}
```

## Arabic: Bidirectional Text

Arabic text is right-to-left (RTL), but numbers and Latin text within Arabic are left-to-right. This creates bidirectional runs that must be reordered for display.

Additionally, Arabic letters change shape based on position:

- **Isolated:** ع
- **Initial:** عـ
- **Medial:** ـعـ
- **Final:** ـع

Pretext handles the Unicode Bidirectional Algorithm (UAX #9), and the font shaping is handled by the Canvas text renderer (Skia via @napi-rs/canvas).

OG Engine ships with **Noto Sans AR** pre-loaded.

### Example

```json
{
  "format": "og",
  "title": "إنشاء صور OG بدون متصفح",
  "description": "محرك تخطيط النص بدون Chrome — 2 مللي ثانية لكل صورة",
  "style": { "font": "Noto Sans AR" }
}
```

## Emoji

Modern emoji are surprisingly complex:

- Flag emoji: 🇫🇷 = two regional indicator symbols
- Skin tone: 👋🏽 = hand + skin tone modifier
- Family: 👨‍👩‍👧‍👦 = four people joined by zero-width joiners (7 codepoints, 1 glyph)
- Compound: ❤️‍🔥 = heart + ZWJ + fire

Naive string operations (like `str.length` or `str.slice()`) break these sequences. Pretext uses grapheme cluster segmentation (UAX #29) to treat each visual emoji as a single unit for line breaking and measurement.

### Example

```json
{
  "format": "og",
  "title": "Ship Features, Not Browsers 🚀",
  "description": "From Tokyo 🇯🇵 to Cairo 🇪🇬 — pixel-perfect text in every language."
}
```

## Mixed Script Content

Real-world titles mix scripts: "新機能: OG Engine v0.2 リリース" contains Japanese, Latin, numbers, and punctuation. Pretext handles script boundary detection and applies appropriate break rules for each segment.

## Pre-Loaded Fonts

OG Engine ships with 8 font families covering major script systems:

| Font | Scripts | Use Case |
|---|---|---|
| Outfit | Latin | Default, modern geometric |
| Inter | Latin | Technical, neutral |
| Noto Sans JP | Latin + CJK | Japanese content |
| Noto Sans AR | Latin + Arabic | Arabic content |
| Playfair Display | Latin | Editorial, elegant |
| Sora | Latin | Friendly, rounded |
| Space Grotesk | Latin | Developer-focused |
| JetBrains Mono | Latin | Code, monospace |

## Try It

Test multilingual rendering in the [Playground](/playground/) — no API key needed. Switch fonts, paste CJK or Arabic text, and see the result instantly.
```

- [ ] **Step 5: Add blog sidebar section in astro.config.mjs**

Add a new sidebar section after "Changelog":

```javascript
{
  label: 'Blog',
  items: [
    { label: 'All Posts', link: '/blog/' },
    { label: 'Why We Built OG Engine', link: '/blog/why-we-built-og-engine/' },
    { label: 'How Pretext Measures Text', link: '/blog/how-pretext-measures-text/' },
    { label: 'Multilingual OG Images', link: '/blog/multilingual-og-images/' },
  ],
},
```

- [ ] **Step 6: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add docs/site/src/content/docs/blog/ docs/site/astro.config.mjs
git commit -m "feat(docs): add blog with 3 launch articles"
```

---

### Task 6: Promote `/validate` as Free Marketing Hook

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Add validate callout to homepage**

In `index.mdx`, after the "One Request" section and before "Formats", add:

```mdx
## Free Text Validation

Check if your text fits — **free, unlimited, no signup required.**

```bash
curl -X POST https://api.og-engine.com/validate \
  -H "Content-Type: application/json" \
  -d '{"format": "og", "title": "Will this headline fit in two lines?"}'
```

```json
{ "fits": true, "title": { "lines": 1, "maxLines": 3, "overflow": false }, "computeTimeMs": 0.08 }
```

<div class="validate-callout">

`POST /validate` is always free. No API key. No rate limits. Use it in your CI pipeline, your CMS, your form validation — anywhere you need to know if text fits before rendering.

[Try it in the Playground →](/playground/)

</div>
```

- [ ] **Step 2: Add CSS for validate callout**

Append to `docs/site/src/styles/custom.css`:

```css
/* ─── Validate Callout ─── */
.validate-callout {
  border: 1px solid var(--og-glow);
  background: linear-gradient(135deg, rgba(56, 239, 125, 0.06) 0%, rgba(5, 8, 16, 0.95) 100%);
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  margin: 1.5rem 0;
}

.validate-callout p {
  margin: 0;
  color: var(--sl-color-gray-1);
  font-size: 0.9rem;
  line-height: 1.6;
}

.validate-callout a {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
}
```

- [ ] **Step 3: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(docs): promote /validate as free marketing hook on homepage"
```

---

### Task 7: Plan Persona Descriptions on Pricing Page

**Files:**
- Modify: `docs/site/src/content/docs/pricing.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Add persona descriptions to each pricing card**

In `docs/site/src/content/docs/pricing.mdx`, add a `<div class="pricing-persona">` after each `<div class="pricing-renders">...</div>` and its meter:

For **Free** card, after the meter div:
```html
<div class="pricing-persona">For personal blogs, side projects, and evaluation.</div>
```

For **Starter** card, after the meter div:
```html
<div class="pricing-persona">For growing products shipping WebP images to production.</div>
```

For **Pro** card, after the meter div:
```html
<div class="pricing-persona">For SaaS platforms generating social images at scale.</div>
```

For **Scale** card, after the meter div:
```html
<div class="pricing-persona">For enterprises needing custom branding, SLA, and dedicated support.</div>
```

- [ ] **Step 2: Add CSS for persona descriptions**

Append to `docs/site/src/styles/custom.css`:

```css
/* ─── Pricing Persona Description ─── */
.pricing-persona {
  font-size: 0.78rem;
  color: var(--og-muted-text);
  font-style: italic;
  margin-top: 0.75rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--og-border);
  line-height: 1.4;
}

/* Remove border-bottom from renders since persona now has it */
.pricing-renders {
  padding-bottom: 0.5rem;
  border-bottom: none;
}
```

- [ ] **Step 3: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/pricing.mdx docs/site/src/styles/custom.css
git commit -m "feat(docs): add plan persona descriptions to pricing page"
```

---

### Task 8: Social Proof Section on Homepage

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Add social proof section to index.mdx**

At the very top of the homepage content (after the hero frontmatter and import, before "Benchmarks"), add:

```mdx
<div class="trust-bar">
  <div class="trust-item">
    <a href="https://github.com/phmatray/og-engine">Open Source on GitHub</a>
  </div>
  <div class="trust-separator">/</div>
  <div class="trust-item">Built in Belgium by <a href="https://atypical.consulting">Atypical Consulting</a></div>
  <div class="trust-separator">/</div>
  <div class="trust-item">Powered by <a href="https://github.com/chenglou/pretext">Pretext</a></div>
</div>
```

- [ ] **Step 2: Add CSS for trust bar**

Append to `docs/site/src/styles/custom.css`:

```css
/* ─── Trust Bar ─── */
.trust-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin: -0.5rem 0 2.5rem;
  flex-wrap: wrap;
}

.trust-item {
  font-family: var(--sl-font-mono);
  font-size: 0.75rem;
  color: var(--og-muted-text);
}

.trust-item a {
  color: var(--sl-color-gray-2) !important;
  text-decoration: none;
  transition: color 0.2s ease;
}

.trust-item a:hover {
  color: var(--og-glow) !important;
}

.trust-separator {
  color: var(--sl-color-gray-3);
  font-family: var(--sl-font-mono);
  font-size: 0.7rem;
}
```

- [ ] **Step 3: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(docs): add trust bar with social proof to homepage"
```

---

### Task 9: Open-Source Positioning

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/astro.config.mjs`

- [ ] **Step 1: Add open-source CTA at the bottom of homepage**

At the very end of `index.mdx` (after the FAQ section), add:

```mdx
---

<div class="oss-callout">

## Open Source

OG Engine is open source. Run it on your own infrastructure with **zero per-render cost**, or use the hosted API and let us handle scaling, caching, and uptime.

<div class="oss-actions">
  <a href="https://github.com/phmatray/og-engine" class="oss-link">View on GitHub →</a>
  <a href="/self-hosting/docker/" class="oss-link">Self-Hosting Guide →</a>
</div>

</div>
```

- [ ] **Step 2: Add CSS for OSS callout**

Append to `docs/site/src/styles/custom.css`:

```css
/* ─── Open Source Callout ─── */
.oss-callout {
  border: 1px solid var(--og-border);
  background: var(--og-surface);
  border-radius: 6px;
  padding: 2rem;
  margin: 2rem 0;
  text-align: center;
}

.oss-callout h2 {
  font-family: 'Syne', sans-serif;
  font-size: 1.25rem;
  margin-top: 0;
}

.oss-callout p {
  color: var(--sl-color-gray-1);
  max-width: 36rem;
  margin: 0.5rem auto 1.5rem;
  font-size: 0.9rem;
}

.oss-actions {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.oss-link {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.02em;
  color: var(--og-glow) !important;
  text-decoration: none;
  transition: text-shadow 0.2s ease;
}

.oss-link:hover {
  text-shadow: 0 0 8px rgba(56, 239, 125, 0.5);
}
```

- [ ] **Step 3: Make Self-Hosting more prominent in sidebar**

In `astro.config.mjs`, move the "Self-Hosting (Docker)" entry higher — place it right after the SDK section:

The sidebar order should become:
```
... SDK ...
Self-Hosting (Docker)
Templates Gallery
Available Fonts
...
```

- [ ] **Step 4: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css docs/site/astro.config.mjs
git commit -m "feat(docs): add open-source positioning to homepage and elevate self-hosting in nav"
```

---

### Task 10: Changelog Marketing Improvements

**Files:**
- Modify: `docs/site/src/content/docs/changelog.mdx`

- [ ] **Step 1: Rewrite changelog with marketing context**

Replace the content of `docs/site/src/content/docs/changelog.mdx` with:

```mdx
---
title: Changelog
description: Release history for OG Engine, including new features, improvements, and bug fixes.
---

All notable changes to OG Engine are documented here. OG Engine follows [Semantic Versioning](https://semver.org/).

---

## v0.1.0 — 2026-04-03

**Initial public release.** Everything you need to replace Puppeteer for image generation.

### API Endpoints

- **`POST /render`** — Generate a single image from a JSON payload. Returns binary PNG (all plans) or WebP (Starter+). Typical render time: 2–5ms.
- **`POST /validate`** — Check whether title and description text fits a layout without generating an image. **Free, unlimited, no authentication required.** Use it in CI, forms, or content pipelines.
- **`POST /render/batch`** — Render up to 100 images in a single API call. Returns a ZIP archive. *Available on Pro and Scale plans — ideal for SaaS platforms generating images during deployment.*
- **`GET /health`** — Returns service status, API version, and lists of available fonts, formats, and templates.
- **`POST /auth/register`** — Get an API key with just your email. No credit card. Instant access.
- **`GET /usage`** — Check your quota at any time.

### Templates

Four production-ready templates — every template works on every plan:

- **`default`** — Accent bar, grid background pattern, tag pill badge, and author line. Supports left, center, and bottom layouts.
- **`social-card`** — Large centered title with minimal decoration. Designed for Twitter and Instagram.
- **`blog-hero`** — Background image compositing with dark overlay. Text anchored to the lower canvas. *Perfect for content-heavy sites.*
- **`email-banner`** — Horizontal CTA-style layout for email headers and newsletter banners. *Use with batch rendering for personalized campaigns.*

### Formats

Five canonical format presets covering every major platform:

| Format | Dimensions | Platform |
|---|---|---|
| `og` | 1200 x 630 px | Open Graph / Facebook |
| `twitter` | 1200 x 675 px | Twitter / X |
| `square` | 1080 x 1080 px | Instagram |
| `linkedin` | 1200 x 627 px | LinkedIn |
| `story` | 1080 x 1920 px | Instagram / TikTok Stories |

### Fonts

Eight pre-loaded font families — including CJK and Arabic support:

- **Outfit** — Modern geometric sans-serif (default). Best for tech and SaaS.
- **Inter** — Neutral, screen-optimized. Best for data-heavy content.
- **Playfair Display** — Elegant serif. Best for editorial and luxury brands.
- **Sora** — Rounded, friendly. Best for consumer products.
- **Space Grotesk** — Techy sans-serif. Best for developer tools.
- **JetBrains Mono** — Monospaced. Best for code-related content.
- **Noto Sans JP** — Full Japanese CJK support. *For products serving Japanese users.*
- **Noto Sans AR** — Full Arabic support with bidirectional text. *For products serving Arabic users.*

### TypeScript SDK

`@atypical-consulting/og-engine-sdk` on npm — full TypeScript types, auto-retry, framework examples:

- `og.render()` — generate an image
- `og.validate()` — check text fits (free)
- `og.batch()` — bulk generation (Pro+)
- `og.usage()` — check quota
- `og.health()` — capabilities and status

Integration examples included for **Next.js**, **Astro**, **Express**, and **Cloudflare Workers**.

### Infrastructure

- **Docker image** available for self-hosting — zero per-render cost
- Fly.io one-command deployment
- Sub-50ms cold starts
- LRU caching for text preparation

### Documentation

- Interactive playground (no API key required)
- Framework-specific integration guides
- Complete API reference
- Templates gallery with visual examples

---

## Upcoming

| Version | Focus | Highlights |
|---|---|---|
| **v0.2.0** | Caching & Analytics | Redis cache layer, API key management dashboard, usage analytics |
| **v0.3.0** | Standards & Fonts | OpenAPI/Swagger specification, additional font families, SVG output |
| **v0.4.0** | Edge & Customization | Cloudflare Workers deployment, custom template DSL |
| **v1.0.0** | Stability | Stable API contract, SLA guarantees, Python/Go/Ruby SDKs |

Subscribe to [status.og-engine.com](https://status.og-engine.com) for release notifications.
```

- [ ] **Step 2: Verify build**

Run: `cd docs/site && npx astro build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/changelog.mdx
git commit -m "feat(docs): rewrite changelog with marketing context and audience targeting"
```

---

## Final Verification

- [ ] **Full build check**

Run: `cd docs/site && npx astro build`
Expected: Clean build with zero errors. All new pages included in output.

- [ ] **Link audit**

Check that all internal links in new pages resolve to existing pages:
- `/quick-start/` — exists
- `/playground/` — exists
- `/self-hosting/docker/` — exists
- `/guides/formats-and-templates/` — exists
- `/api-reference/overview/` — exists
- `/blog/*` — created in Task 5
- `/compare/puppeteer/` — created in Task 1

- [ ] **Final commit (if any fixes needed)**

```bash
git add -A docs/site/
git commit -m "fix(docs): resolve build issues from marketing improvements"
```
