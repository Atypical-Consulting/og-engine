# Template Expansion — Design Spec

## Goal

Expand OG Engine from 4 built-in templates to 12, covering real-world use cases that leverage the new `variables` and `namedImages` system. Refactor the monolithic `templates.ts` into individual files.

## Architecture

### File Structure

Split `src/engine/templates.ts` (currently ~500 lines, 4 templates) into:

```
src/engine/templates/
  index.ts          — TEMPLATES registry, exports TemplateFn, TemplateInput, TemplateResult, TEMPLATE_NAMES
  helpers.ts        — shared: paintBackgroundMesh, drawBgImage, fitTitleLines, hexToRgb, rgba
  default.ts        — existing default template
  social-card.ts    — existing social-card template
  blog-hero.ts      — existing blog-hero template
  email-banner.ts   — existing email-banner template
  product-card.ts   — NEW
  event.ts          — NEW
  testimonial.ts    — NEW
  github-repo.ts    — NEW
  news-article.ts   — NEW
  pricing.ts        — NEW
  profile-card.ts   — NEW
  announcement.ts   — NEW
```

`src/engine/templates.ts` becomes a re-export barrel:
```typescript
export { TEMPLATES, TEMPLATE_NAMES, getTemplate } from './templates/index';
export type { TemplateFn, TemplateInput, TemplateResult } from './templates/index';
```

This preserves all existing imports across the codebase.

### Template Designs

All templates:
- Accept the standard `TemplateInput` interface
- Read custom data from `input.variables` (with fallback to `input.content.*` for legacy fields)
- Read images from `input.namedImages` (with fallback to `input.bgImage`)
- Use existing helpers for background, text measurement, auto-shrink
- Support accent color, gradient, font, and layout options
- Return `TemplateResult` with line counts and overflow

#### 1. `product-card`
- **Variables:** `title` (product name), `price`, `badge` (e.g. "-20%"), `brand`
- **Images:** `product` (main image, right side), `logo` (small, top-left)
- **Layout:** Split — left side has text content, right side has product image. Badge pill in accent color. Price in large bold. Brand name subtle at top.

#### 2. `event`
- **Variables:** `title` (event name), `date`, `location`, `speaker`
- **Images:** `background`, `logo` (top-left corner)
- **Layout:** Full-width background image with gradient overlay. Title large at center-bottom. Date + location in a horizontal bar. Speaker name if provided. Logo in corner.

#### 3. `testimonial`
- **Variables:** `quote` (maps from title), `name`, `company`, `role`
- **Images:** `avatar` (circular, centered above quote or left-aligned)
- **Layout:** Large opening quote mark in accent. Quote text centered, italic. Author line: name + role + company below. Avatar circular if provided.

#### 4. `github-repo`
- **Variables:** `title` (repo name), `description`, `stars`, `language`, `owner`
- **Images:** `avatar` (owner avatar, circular)
- **Layout:** Dark theme (forced dark gradient). Repo icon + owner/name at top. Description below. Bottom bar: language dot + star count. Monospace font for repo name.

#### 5. `news-article`
- **Variables:** `title`, `source` (publication name), `date`, `category`
- **Images:** `background` (article hero), `logo` (publication logo)
- **Layout:** Full-bleed background with strong bottom gradient. Category pill at top. Large title. Source + date line at bottom. Logo in corner.

#### 6. `pricing`
- **Variables:** `plan` (plan name), `price`, `period` (e.g. "/mo"), `features` (comma-separated), `cta` (button text)
- **Images:** `logo`
- **Layout:** Centered card feel. Plan name at top in accent. Large price. Feature list with checkmarks. CTA button at bottom. Logo subtle at top.

#### 7. `profile-card`
- **Variables:** `name`, `role`, `company`, `bio`
- **Images:** `avatar` (large, centered or left), `logo` (company logo, small)
- **Layout:** Avatar prominent (large circle). Name large below. Role + company in muted text. Bio as description. Logo in corner.

#### 8. `announcement`
- **Variables:** `title`, `subtitle`, `cta` (call to action), `tag`
- **Images:** `background`, `logo`
- **Layout:** Dramatic. Background with heavy overlay. Tag pill at top. Title very large, centered. Subtitle below. CTA button at bottom in accent. Logo in corner.

### Registration

All templates registered in `src/engine/templates/index.ts`:
```typescript
export const TEMPLATES: Record<string, TemplateFn> = {
  default: defaultTemplate,
  'social-card': socialCardTemplate,
  'blog-hero': blogHeroTemplate,
  'email-banner': emailBannerTemplate,
  'product-card': productCardTemplate,
  'event': eventTemplate,
  'testimonial': testimonialTemplate,
  'github-repo': githubRepoTemplate,
  'news-article': newsArticleTemplate,
  'pricing': pricingTemplate,
  'profile-card': profileCardTemplate,
  'announcement': announcementTemplate,
};
```

### Testing

Each new template gets a render test: call `renderCard()` with appropriate variables, verify it produces a valid PNG buffer without error. Tests in `tests/engine/templates.test.ts` (extend existing).

### Client-Side Sync

The Playground's `canvas-renderer.ts` also has template implementations. The new templates should be added there too so the playground can preview them client-side. This is a separate concern — can be done in a follow-up.
