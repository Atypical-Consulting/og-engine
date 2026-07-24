# Flexible Data Model — Variables, Named Images & URL-to-Image

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform OG Engine from a 4-field blog card generator into a flexible image generation platform that accepts arbitrary variables, multiple named images, and can auto-extract content from URLs.

**Architecture:** Extend the existing render pipeline to accept a `variables` map (any key/value pairs) and an `images` map (named image URLs fetched server-side). The 4 legacy fields (`title`, `description`, `author`, `tag`) become sugar for `variables.*`. A new `POST /render/from-url` endpoint scrapes OG meta tags and feeds them into the standard pipeline. Custom template DSL already supports `{{interpolation}}` — we widen the data it receives.

**Tech Stack:** Hono, Zod, @napi-rs/canvas, Vitest. No new dependencies except `cheerio` for HTML parsing (meta extraction).

---

## Scope & File Map

### Modified files

| File | Responsibility |
|------|---------------|
| `src/schemas/request.ts` | Add `variables` and `images` to render schema |
| `src/engine/renderer.ts` | Accept & pass `variables` + loaded images to templates |
| `src/engine/custom-template.ts` | Use full variables map; image layers reference named images |
| `src/engine/templates.ts` | Update `TemplateInput` to include `variables` + `images` map |
| `src/api/render.ts` | Merge legacy fields into variables; fetch named image URLs |
| `sdk/index.ts` | Add `variables`, `images`, `renderFromUrl` types + method |
| `tests/engine/renderer.test.ts` | Add variable/image passthrough tests |
| `tests/engine/custom-template.test.ts` | Add named image source tests |
| `tests/api/render.test.ts` | Add variables + images integration tests |

### New files

| File | Responsibility |
|------|---------------|
| `src/engine/image-loader.ts` | Fetch remote images by URL, return `@napi-rs/canvas` Image |
| `src/engine/meta-extract.ts` | Parse HTML and extract OG/meta tags into variables + images |
| `src/api/render-from-url.ts` | `POST /render/from-url` endpoint |
| `tests/engine/image-loader.test.ts` | Image loader tests |
| `tests/engine/meta-extract.test.ts` | Meta extraction tests |
| `tests/api/render-from-url.test.ts` | URL-to-image endpoint tests |

---

## Task 1: Add `variables` to the Render Schema

**Files:**
- Modify: `src/schemas/request.ts`
- Test: `tests/api/render.test.ts`

The schema accepts an optional `variables: Record<string, string>` alongside the existing `title`/`description`/`author`/`tag`. Both work. Variables take precedence if both are provided.

- [ ] **Step 1: Write the failing test for variables in the schema**

In `tests/api/render.test.ts`, add a new describe block. The test imports the schema and validates a request with variables.

```typescript
// Add to the top-level describe in tests/api/render.test.ts
describe('renderSchema with variables', () => {
  it('accepts a request with variables', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'My Product',
      variables: {
        price: '€129',
        badge: '-20%',
        rating: '4.8',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variables).toEqual({
        price: '€129',
        badge: '-20%',
        rating: '4.8',
      });
    }
  });

  it('defaults variables to empty object when omitted', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variables).toEqual({});
    }
  });

  it('rejects non-string variable values', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Test',
      variables: { count: 42 },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/render.test.ts --reporter=verbose
```

Expected: FAIL — `variables` not recognized by schema.

- [ ] **Step 3: Add `variables` to `renderSchema`**

In `src/schemas/request.ts`, add the variables field to the render schema:

```typescript
// Add after the `tag` field in renderSchema
variables: z.record(z.string(), z.string()).default({}),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/api/render.test.ts --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/request.ts tests/api/render.test.ts
git commit -m "feat(schema): add variables field to render schema"
```

---

## Task 2: Add `images` to the Render Schema

**Files:**
- Modify: `src/schemas/request.ts`
- Test: `tests/api/render.test.ts`

Named images are URLs that the server will fetch. The existing `backgroundImage` upload (multipart) continues to work for the `background` slot.

- [ ] **Step 1: Write the failing test for images in the schema**

```typescript
// Add to tests/api/render.test.ts
describe('renderSchema with images', () => {
  it('accepts a request with named image URLs', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Product',
      images: {
        logo: 'https://example.com/logo.png',
        avatar: 'https://example.com/avatar.jpg',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual({
        logo: 'https://example.com/logo.png',
        avatar: 'https://example.com/avatar.jpg',
      });
    }
  });

  it('defaults images to empty object when omitted', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual({});
    }
  });

  it('rejects non-URL image values', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Test',
      images: { logo: 'not-a-url' },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/render.test.ts --reporter=verbose
```

Expected: FAIL — `images` not recognized.

- [ ] **Step 3: Add `images` to `renderSchema`**

In `src/schemas/request.ts`:

```typescript
// Add after the `variables` field in renderSchema
images: z.record(z.string(), z.string().url('Each image value must be a valid URL.')).default({}),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/api/render.test.ts --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/request.ts tests/api/render.test.ts
git commit -m "feat(schema): add named images field to render schema"
```

---

## Task 3: Build the Image Loader

**Files:**
- Create: `src/engine/image-loader.ts`
- Create: `tests/engine/image-loader.test.ts`

Fetches remote images by URL and returns `@napi-rs/canvas` Image objects. Includes timeout, size limit, and content-type validation.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/engine/image-loader.test.ts
import { describe, expect, it } from 'vitest';
import { loadRemoteImage, loadRemoteImages } from '../../src/engine/image-loader';

describe('loadRemoteImage', () => {
  it('loads a valid PNG image from a URL', async () => {
    // Use a known small public image (1x1 PNG)
    const img = await loadRemoteImage(
      'https://www.google.com/favicon.ico',
    );
    expect(img).toBeDefined();
    expect(img!.width).toBeGreaterThan(0);
    expect(img!.height).toBeGreaterThan(0);
  });

  it('returns null for invalid URLs', async () => {
    const img = await loadRemoteImage('https://this-domain-does-not-exist-12345.com/img.png');
    expect(img).toBeNull();
  });

  it('returns null for non-image content types', async () => {
    const img = await loadRemoteImage('https://example.com');
    expect(img).toBeNull();
  });
});

describe('loadRemoteImages', () => {
  it('loads multiple images in parallel', async () => {
    const result = await loadRemoteImages({
      favicon: 'https://www.google.com/favicon.ico',
      bad: 'https://this-domain-does-not-exist-12345.com/nope.png',
    });
    expect(result.favicon).toBeDefined();
    expect(result.bad).toBeNull();
  });

  it('returns empty map for empty input', async () => {
    const result = await loadRemoteImages({});
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/image-loader.test.ts --reporter=verbose
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the image loader**

```typescript
// src/engine/image-loader.ts
import { type Image, loadImage } from '@napi-rs/canvas';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

/**
 * Fetch a single remote image. Returns null on any failure (timeout,
 * bad content type, decode error, etc.) — never throws.
 */
export async function loadRemoteImage(url: string): Promise<Image | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OGEngine/1.0' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(ct)) return null;

    const contentLength = Number(res.headers.get('content-length') ?? '0');
    if (contentLength > MAX_IMAGE_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;

    return await loadImage(buf);
  } catch {
    return null;
  }
}

/**
 * Fetch multiple named images in parallel.
 * Returns a map with the same keys — values are Image | null.
 */
export async function loadRemoteImages(
  urls: Record<string, string>,
): Promise<Record<string, Image | null>> {
  const entries = Object.entries(urls);
  if (entries.length === 0) return {};

  const results = await Promise.all(
    entries.map(async ([name, url]) => {
      const img = await loadRemoteImage(url);
      return [name, img] as const;
    }),
  );

  return Object.fromEntries(results);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/engine/image-loader.test.ts --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/image-loader.ts tests/engine/image-loader.test.ts
git commit -m "feat(engine): add remote image loader with timeout and size limits"
```

---

## Task 4: Thread Variables + Images Through the Renderer

**Files:**
- Modify: `src/engine/renderer.ts` (RenderOptions, renderCard)
- Modify: `src/engine/templates.ts` (TemplateInput)
- Modify: `src/engine/custom-template.ts` (renderCustomTemplate signature + vars map)
- Test: `tests/engine/renderer.test.ts`

This is the core plumbing. `RenderOptions` gains `variables` and `namedImages`. Templates receive them. Custom templates get the full variables map for interpolation.

- [ ] **Step 1: Write failing tests for variable passthrough**

Add to `tests/engine/renderer.test.ts`:

```typescript
describe('renderCard with variables', () => {
  it('renders with custom variables without error', async () => {
    const result = await renderCard({
      ...defaultOptions(),
      variables: { price: '€129', badge: '-20%' },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('passes variables through to custom templates', async () => {
    // Custom templates use {{interpolation}} — we test that the renderer
    // passes variables correctly by rendering a custom template with a
    // variable that isn't title/description/author/tag.
    const result = await renderCard({
      ...defaultOptions(),
      variables: { headline: 'Custom Headline' },
      customTemplateDefinition: {
        name: 'test-vars',
        layers: [
          { type: 'fill', color: '#000000' },
          {
            type: 'text',
            content: '{{headline}}',
            fontSize: 48,
            x: 100,
            y: 100,
            width: 1000,
            color: '#ffffff',
          },
        ],
      },
      template: 'custom:test-vars',
    });
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/renderer.test.ts --reporter=verbose
```

Expected: FAIL — `variables` not in RenderOptions type.

- [ ] **Step 3: Update `RenderOptions` in `src/engine/renderer.ts`**

Add `variables` and `namedImages` to the interface and pass them through:

```typescript
// In RenderOptions interface, add after `tag`:
variables: Record<string, string>;
namedImages: Record<string, import('@napi-rs/canvas').Image | null>;
```

In the `renderCard` function, build the merged variables map and pass it:

```typescript
// After destructuring options, build the full variables map:
const variables: Record<string, string> = {
  title,
  description,
  author,
  tag,
  ...options.variables,
};

// Pass to custom template renderer (replace the existing content + style args):
result = renderCustomTemplate(
  options.customTemplateDefinition,
  ctx,
  W,
  H,
  variables,
  { accent, fontFamily: fontEntry.family },
  bgImage,
  options.namedImages,
);

// Pass to built-in template (add variables + namedImages to TemplateInput):
result = templateFn({
  canvas,
  ctx,
  width: W,
  height: H,
  format: fmt,
  content: { title, description, author, tag },
  style: {
    accent,
    layout,
    fontFamily: fontEntry.family,
    titleSize,
    descSize,
    gradient: gradientSlug,
  },
  bgImage,
  overlayOpacity,
  variables,
  namedImages: options.namedImages,
});
```

- [ ] **Step 4: Update `TemplateInput` in `src/engine/templates.ts`**

Add to the `TemplateInput` interface:

```typescript
variables: Record<string, string>;
namedImages: Record<string, import('@napi-rs/canvas').Image | null>;
```

Built-in templates ignore these for now — they still use `content.*` directly. No behavioral change to existing templates.

- [ ] **Step 5: Update `renderCustomTemplate` in `src/engine/custom-template.ts`**

Change the function signature to accept the full variables map directly instead of the fixed content object, plus named images:

```typescript
export function renderCustomTemplate(
  definition: CustomTemplateDefinition,
  ctx: SKRSContext2D,
  W: number,
  H: number,
  variables: Record<string, string>,
  style: { accent: string; fontFamily: string },
  bgImage: Image | null,
  namedImages: Record<string, Image | null>,
): TemplateResult {
  const vars: Record<string, string> = {
    ...variables,
    accent: style.accent,
  };
  // ... rest of function uses `vars` as before (already does)
```

For the image layer, look up named images by a new `source` field:

```typescript
case 'image': {
  // Use named image if `source` is specified, otherwise fall back to bgImage
  const sourceImg = layer.source
    ? (namedImages[layer.source] ?? null)
    : rc.bgImage;
  if (!sourceImg) break;
  // ... rest of drawing code uses sourceImg instead of rc.bgImage
```

Add `source` to the image layer schema:

```typescript
const imageLayer = layerBase.extend({
  type: z.literal('image'),
  source: z.string().optional(), // named image key, e.g. "logo", "avatar"
  fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
});
```

- [ ] **Step 6: Update `defaultOptions` in test helper**

In `tests/engine/renderer.test.ts`, add the new fields to `defaultOptions`:

```typescript
function defaultOptions(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return {
    // ... existing fields ...
    variables: {},
    namedImages: {},
    ...overrides,
  };
}
```

- [ ] **Step 7: Run ALL tests to verify nothing breaks**

```bash
npx vitest run --reporter=verbose
```

Expected: All 142+ tests PASS (existing + new).

- [ ] **Step 8: Commit**

```bash
git add src/engine/renderer.ts src/engine/templates.ts src/engine/custom-template.ts tests/engine/renderer.test.ts
git commit -m "feat(engine): thread variables and named images through render pipeline"
```

---

## Task 5: Wire Variables + Images in the API Route

**Files:**
- Modify: `src/api/render.ts`
- Test: `tests/api/render.test.ts`

The API route merges `title`/`description`/`author`/`tag` into the variables map, fetches named image URLs, and passes everything to `renderCard`.

- [ ] **Step 1: Write failing integration test**

Add to `tests/api/render.test.ts`:

```typescript
describe('POST /render with variables', () => {
  it('accepts variables alongside legacy fields', async () => {
    const res = await app.request('/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testApiKey}`,
      },
      body: JSON.stringify({
        format: 'og',
        title: 'Product Name',
        variables: { price: '€129', badge: '-20%' },
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });
});
```

> **Note:** This test depends on the app test setup already present in `tests/api/render.test.ts`. Use the same setup pattern (importing the Hono app, creating a test API key, etc.).

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/render.test.ts --reporter=verbose
```

Expected: FAIL — `renderCard` called without `variables`/`namedImages`.

- [ ] **Step 3: Update `src/api/render.ts`**

After parsing with `renderSchema`, merge legacy fields and fetch images:

```typescript
import { loadRemoteImages } from '../engine/image-loader';

// After `const data = parsed.data;` and before calling renderCard:

// Merge legacy content fields into variables
const variables: Record<string, string> = {
  title: data.title,
  description: data.description,
  author: data.author,
  tag: data.tag,
  ...data.variables,
};

// Fetch named remote images (in parallel)
const namedImages = Object.keys(data.images).length > 0
  ? await loadRemoteImages(data.images)
  : {};

// Then pass to renderCard:
const result = await renderCard({
  title: data.title,
  description: data.description,
  author: data.author,
  tag: data.tag,
  variables,
  namedImages,
  format: data.format,
  template: data.template,
  // ... rest unchanged ...
});
```

Also update the cache key logic: if `images` has URLs, skip the cache (same as bgImageBuffer, since remote content can change).

- [ ] **Step 4: Run tests to verify all pass**

```bash
npx vitest run --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/render.ts tests/api/render.test.ts
git commit -m "feat(api): wire variables and named images into /render endpoint"
```

---

## Task 6: Build the Meta Extraction Module

**Files:**
- Create: `src/engine/meta-extract.ts`
- Create: `tests/engine/meta-extract.test.ts`

Extracts OG tags, Twitter tags, standard meta tags, and `<title>` from HTML. Maps them to a variables + images structure for rendering.

- [ ] **Step 1: Install cheerio**

```bash
bun add cheerio
```

- [ ] **Step 2: Write the failing tests**

```typescript
// tests/engine/meta-extract.test.ts
import { describe, expect, it } from 'vitest';
import { extractMeta } from '../../src/engine/meta-extract';

const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>My Blog Post</title>
  <meta property="og:title" content="OG Title Override" />
  <meta property="og:description" content="A great article about testing." />
  <meta property="og:image" content="https://example.com/og.jpg" />
  <meta name="author" content="Jane Doe" />
  <meta property="article:tag" content="Testing" />
  <meta property="og:site_name" content="My Blog" />
</head>
<body></body>
</html>`;

describe('extractMeta', () => {
  it('extracts OG tags into variables', () => {
    const result = extractMeta(sampleHtml);
    expect(result.variables.title).toBe('OG Title Override');
    expect(result.variables.description).toBe('A great article about testing.');
    expect(result.variables.author).toBe('Jane Doe');
    expect(result.variables.tag).toBe('Testing');
    expect(result.variables.siteName).toBe('My Blog');
  });

  it('extracts og:image into images map', () => {
    const result = extractMeta(sampleHtml);
    expect(result.images.background).toBe('https://example.com/og.jpg');
  });

  it('falls back to <title> when og:title is missing', () => {
    const html = '<html><head><title>Fallback Title</title></head></html>';
    const result = extractMeta(html);
    expect(result.variables.title).toBe('Fallback Title');
  });

  it('falls back to meta description when og:description is missing', () => {
    const html = '<html><head><meta name="description" content="Meta desc" /></head></html>';
    const result = extractMeta(html);
    expect(result.variables.description).toBe('Meta desc');
  });

  it('handles missing meta tags gracefully', () => {
    const html = '<html><head></head><body></body></html>';
    const result = extractMeta(html);
    expect(result.variables.title).toBe('');
    expect(result.variables.description).toBe('');
    expect(result.images).toEqual({});
  });

  it('extracts twitter:image when og:image is missing', () => {
    const html = '<html><head><meta name="twitter:image" content="https://example.com/tw.jpg" /></head></html>';
    const result = extractMeta(html);
    expect(result.images.background).toBe('https://example.com/tw.jpg');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/engine/meta-extract.test.ts --reporter=verbose
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement meta extraction**

```typescript
// src/engine/meta-extract.ts
import * as cheerio from 'cheerio';

export interface MetaResult {
  variables: Record<string, string>;
  images: Record<string, string>;
}

/**
 * Extract OG/meta tags from an HTML string and return them as
 * variables + images suitable for the render pipeline.
 */
export function extractMeta(html: string): MetaResult {
  const $ = cheerio.load(html);

  const og = (prop: string): string =>
    $(`meta[property="${prop}"]`).attr('content') ?? '';

  const meta = (name: string): string =>
    $(`meta[name="${name}"]`).attr('content') ?? '';

  const title =
    og('og:title') ||
    meta('twitter:title') ||
    $('title').text().trim();

  const description =
    og('og:description') ||
    meta('twitter:description') ||
    meta('description');

  const author =
    meta('author') ||
    og('article:author') ||
    meta('twitter:creator');

  const tag =
    og('article:tag') ||
    og('article:section') ||
    meta('keywords')?.split(',')[0]?.trim() || '';

  const siteName = og('og:site_name');

  const ogImage =
    og('og:image') ||
    meta('twitter:image');

  const variables: Record<string, string> = {
    title,
    description,
    author,
    tag,
  };

  if (siteName) variables.siteName = siteName;

  const images: Record<string, string> = {};
  if (ogImage) images.background = ogImage;

  return { variables, images };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/engine/meta-extract.test.ts --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/meta-extract.ts tests/engine/meta-extract.test.ts package.json bun.lockb
git commit -m "feat(engine): add HTML meta tag extraction for URL-to-image"
```

---

## Task 7: Build the `POST /render/from-url` Endpoint

**Files:**
- Create: `src/api/render-from-url.ts`
- Modify: `src/index.ts` (register route)
- Create: `tests/api/render-from-url.test.ts`

Fetches a URL, extracts meta, renders the image. Accepts optional `format`, `template`, `style` overrides.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/api/render-from-url.test.ts
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerFonts } from '../../src/engine/fonts';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

// Test the schema only — actual URL fetching is mocked in integration tests
import { renderFromUrlSchema } from '../../src/api/render-from-url';

describe('renderFromUrlSchema', () => {
  it('accepts a valid URL request', () => {
    const result = renderFromUrlSchema.safeParse({
      url: 'https://example.com/blog/my-post',
    });
    expect(result.success).toBe(true);
  });

  it('accepts URL with format and template overrides', () => {
    const result = renderFromUrlSchema.safeParse({
      url: 'https://example.com/blog/my-post',
      format: 'twitter',
      template: 'social-card',
      style: { accent: '#fb7185' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing URL', () => {
    const result = renderFromUrlSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = renderFromUrlSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/render-from-url.test.ts --reporter=verbose
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the endpoint**

```typescript
// src/api/render-from-url.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { FONTS } from '../engine/fonts';
import { FORMAT_KEYS } from '../engine/formats';
import { GRADIENTS } from '../engine/gradients';
import { loadRemoteImages } from '../engine/image-loader';
import { extractMeta } from '../engine/meta-extract';
import { renderCard } from '../engine/renderer';
import { TEMPLATE_NAMES } from '../engine/templates';

const fontNames = FONTS.map((f) => f.name);
const gradientSlugs = GRADIENTS.map((g) => g.slug);
const formatEnum = z.enum(FORMAT_KEYS as [string, ...string[]]);

export const renderFromUrlSchema = z.object({
  url: z.string().url('A valid URL is required.'),
  format: formatEnum.default('og'),
  template: z
    .string()
    .refine((v) => TEMPLATE_NAMES.includes(v) || v.startsWith('custom:'), {
      message: `Template must be one of: ${TEMPLATE_NAMES.join(', ')}, or "custom:<name>"`,
    })
    .default('default'),
  style: z
    .object({
      accent: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .default('#38ef7d'),
      layout: z.enum(['left', 'center', 'bottom']).default('left'),
      font: z
        .string()
        .refine((v) => fontNames.includes(v))
        .default('Outfit'),
      titleSize: z.number().int().min(28).max(72).default(48),
      descSize: z.number().int().min(14).max(32).default(22),
      gradient: z
        .string()
        .refine((v) => gradientSlugs.includes(v))
        .default('void'),
      overlayOpacity: z.number().min(0.2).max(0.9).default(0.65),
      autoFit: z.boolean().default(true), // default ON for URL renders
    })
    .default({}),
  output: z
    .object({
      format: z.enum(['png', 'webp', 'pdf']).default('png'),
      quality: z.number().int().min(1).max(100).default(90),
    })
    .default({}),
});

export const renderFromUrlRoute = new Hono();

const FETCH_TIMEOUT_MS = 8_000;

renderFromUrlRoute.post('/render/from-url', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json(
      {
        error: 'invalid_request',
        message: 'Request body must be valid JSON.',
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const parsed = renderFromUrlSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return c.json(
      {
        error: 'invalid_request',
        message: issues[0]?.message ?? 'Validation failed.',
        details: { fields: issues },
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const data = parsed.data;

  // Fetch the URL
  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(data.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OGEngine/1.0 (og-engine.com)' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return c.json(
        {
          error: 'fetch_failed',
          message: `Could not fetch URL: HTTP ${res.status}`,
          docs: 'https://og-engine.com/api-reference/errors#fetch_failed',
        },
        422,
      );
    }
    html = await res.text();
  } catch (err) {
    return c.json(
      {
        error: 'fetch_failed',
        message: `Could not fetch URL: ${err instanceof Error ? err.message : 'timeout or network error'}`,
        docs: 'https://og-engine.com/api-reference/errors#fetch_failed',
      },
      422,
    );
  }

  // Extract meta tags
  const meta = extractMeta(html);

  if (!meta.variables.title) {
    return c.json(
      {
        error: 'no_content',
        message: 'No title found on the page (checked og:title, twitter:title, <title>).',
        docs: 'https://og-engine.com/api-reference/errors#no_content',
      },
      422,
    );
  }

  // Fetch images from extracted URLs
  const namedImages = Object.keys(meta.images).length > 0
    ? await loadRemoteImages(meta.images)
    : {};

  // Determine if we have a background image
  const bgImage = namedImages.background ?? null;
  const bgImageBuffer = null; // background is loaded via namedImages, not raw buffer

  const t0 = performance.now();

  const result = await renderCard({
    title: meta.variables.title,
    description: meta.variables.description ?? '',
    author: meta.variables.author ?? '',
    tag: meta.variables.tag ?? '',
    variables: meta.variables,
    namedImages,
    format: data.format,
    template: data.template,
    accent: data.style.accent,
    layout: data.style.layout,
    titleSize: data.style.titleSize,
    descSize: data.style.descSize,
    fontName: data.style.font,
    gradient: data.style.gradient,
    bgImageBuffer,
    overlayOpacity: data.style.overlayOpacity,
    autoFit: data.style.autoFit,
    outputFormat: data.output.format,
    outputQuality: data.output.quality,
  });

  const renderTimeMs = (performance.now() - t0).toFixed(2);

  const headers: Record<string, string> = {
    'Content-Type': result.contentType,
    'X-Render-Time-Ms': renderTimeMs,
    'X-Title-Lines': String(result.titleVisibleLines),
    'X-Desc-Lines': String(result.descVisibleLines),
    'X-Layout-Overflow': String(result.overflow),
    'X-Source-URL': data.url,
    'X-Cache': 'miss',
  };

  return new Response(new Uint8Array(result.buffer), { status: 200, headers });
});
```

- [ ] **Step 4: Register the route in `src/index.ts`**

Add after the existing render route registration:

```typescript
import { renderFromUrlRoute } from './api/render-from-url';

// Inside the route setup, after renderRoute:
app.route('/', renderFromUrlRoute);
```

The route should use the same `authMiddleware` as `/render` since it counts against quota.

- [ ] **Step 5: Run tests to verify all pass**

```bash
npx vitest run --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/api/render-from-url.ts src/index.ts tests/api/render-from-url.test.ts
git commit -m "feat(api): add POST /render/from-url endpoint with meta extraction"
```

---

## Task 8: Update the SDK

**Files:**
- Modify: `sdk/index.ts`

Add `variables`, `images` to `RenderRequest`, plus new `renderFromUrl` method and types.

- [ ] **Step 1: Add types for the new features**

In `sdk/index.ts`, update `RenderRequest`:

```typescript
export interface RenderRequest {
  format: ImageFormat;
  title: string;
  template?: TemplateName | `custom:${string}`;
  description?: string;
  author?: string;
  tag?: string;
  /** Arbitrary key-value pairs for template interpolation. */
  variables?: Record<string, string>;
  /** Named image URLs to fetch server-side. */
  images?: Record<string, string>;
  style?: RenderStyle;
  output?: {
    format?: OutputFormat;
    quality?: number;
  };
  backgroundImage?: Buffer | Uint8Array;
}
```

- [ ] **Step 2: Add `RenderFromUrlRequest` type and method**

```typescript
export interface RenderFromUrlRequest {
  url: string;
  format?: ImageFormat;
  template?: TemplateName | `custom:${string}`;
  style?: RenderStyle;
  output?: {
    format?: OutputFormat;
    quality?: number;
  };
}

// In the OGEngine class, add:

/**
 * Fetch a URL, extract OG meta tags, and render an image.
 * The server extracts title, description, author, and og:image automatically.
 */
async renderFromUrl(request: RenderFromUrlRequest): Promise<BufferWithMeta> {
  const res = await this.fetchWithRetry(`${this.baseUrl}/render/from-url`, {
    method: 'POST',
    headers: this.headers(),
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({
      message: `HTTP ${res.status}`,
    }))) as Record<string, unknown>;
    throw new OGEngineError(res.status, err as { message: string });
  }

  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  return attachMeta(buf, {
    renderTimeMs: Number.parseFloat(res.headers.get('X-Render-Time-Ms') ?? '0'),
    titleLines: Number(res.headers.get('X-Title-Lines') ?? 0),
    descLines: Number(res.headers.get('X-Desc-Lines') ?? 0),
    layoutOverflow: res.headers.get('X-Layout-Overflow') === 'true',
    cached: res.headers.get('X-Cache') === 'hit',
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add sdk/index.ts
git commit -m "feat(sdk): add variables, images, and renderFromUrl support"
```

---

## Task 9: Update Custom Template Tests for Named Images

**Files:**
- Modify: `tests/engine/custom-template.test.ts`

Verify that the `source` field on image layers works correctly with named images.

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/custom-template.test.ts`:

```typescript
describe('renderCustomTemplate with named images', () => {
  it('renders image layer with source referencing a named image', () => {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // We can't easily load a real image in a unit test, so test that
    // the template renders without error when named images is empty
    // and source references a missing image (should skip gracefully).
    const result = renderCustomTemplate(
      {
        name: 'test-named-img',
        layers: [
          { type: 'fill', color: '#000000' },
          { type: 'image', source: 'logo', x: 50, y: 50, width: 200, height: 200 },
          {
            type: 'text',
            content: '{{title}}',
            fontSize: 48,
            x: 100,
            y: 300,
            width: 1000,
            color: '#ffffff',
          },
        ],
      },
      ctx,
      1200,
      630,
      { title: 'Test', description: '', author: '', tag: '' },
      { accent: '#38ef7d', fontFamily: 'Outfit' },
      null,
      {}, // empty named images — logo should be skipped gracefully
    );

    expect(result.overflow).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/custom-template.test.ts --reporter=verbose
```

Expected: FAIL — `renderCustomTemplate` doesn't accept the 8th argument yet (if Task 4 isn't done), or the `source` field is rejected by the schema.

- [ ] **Step 3: Run test to verify it passes** (after Task 4 changes)

```bash
npx vitest run tests/engine/custom-template.test.ts --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/engine/custom-template.test.ts
git commit -m "test: add named image source tests for custom templates"
```

---

## Task 10: Run Full Test Suite & Fix Any Regressions

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
npx vitest run --reporter=verbose
```

Expected: All tests PASS (original 142 + new tests).

- [ ] **Step 2: Run the dev server and test manually**

```bash
bun run dev &
sleep 2

# Test classic render (backwards compat)
curl -s -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"format":"og","title":"Hello World"}' \
  --output /tmp/test-classic.png

# Test with variables
curl -s -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"format":"og","title":"Product","variables":{"price":"€129","badge":"-20%"}}' \
  --output /tmp/test-vars.png

# Test with named images
curl -s -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"format":"og","title":"With Logo","images":{"background":"https://picsum.photos/1200/630"}}' \
  --output /tmp/test-images.png

# Test from-url
curl -s -X POST http://localhost:3000/render/from-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/hono-dev/hono"}' \
  --output /tmp/test-from-url.png

# Verify all are valid PNGs
file /tmp/test-classic.png /tmp/test-vars.png /tmp/test-images.png /tmp/test-from-url.png
```

Expected: All files are valid PNG images.

- [ ] **Step 3: Stop dev server and commit any fixes**

```bash
kill %1
```

If any tests fail or manual testing reveals issues, fix them and commit:

```bash
git add -A
git commit -m "fix: address regressions from flexible data model integration"
```

---

## Summary of Changes

After completing all tasks:

| What | Before | After |
|------|--------|-------|
| Content fields | 4 fixed: title, description, author, tag | Any key-value via `variables` (+ 4 legacy fields for compat) |
| Image inputs | 1 background image (upload only) | Named images by URL (`images: { logo, avatar, ... }`) + upload |
| Custom template data | 5 interpolation vars | Unlimited `{{anything}}` interpolation |
| Custom template images | 1 bgImage for all image layers | `source: "logo"` picks from named images map |
| URL rendering | Not possible | `POST /render/from-url` — auto-extracts title, desc, og:image |
| SDK | Fixed fields only | `variables`, `images`, `renderFromUrl()` |

**Backwards compatibility:** 100%. Existing requests with `title`/`description`/`author`/`tag` work identically. The new fields are all optional with empty defaults.

**New dependency:** `cheerio` (for HTML meta extraction). Zero-dep alternative: regex-based extraction, but cheerio is battle-tested and ~100KB.

---

## What This Unlocks (Next Plans)

With this foundation, the following become straightforward separate plans:

1. **New templates** (product-card, event, testimonial, github-repo, tweet, job-posting) — each is just a new `TemplateFn` that reads from `variables` and `namedImages`
2. **Brand themes** — stored default variables/style per API key, merged at render time
3. **Dashboard** — web UI for usage, account, API key management
4. **Template marketplace** — fork + customize templates, share publicly
