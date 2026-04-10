# Template Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand OG Engine from 4 to 12 built-in templates, each serving a real-world use case and leveraging the new variables + namedImages system.

**Architecture:** Split monolithic `src/engine/templates.ts` into individual files under `src/engine/templates/`, then add 8 new template functions. Each template reads custom data from `input.variables` and images from `input.namedImages`.

**Tech Stack:** @napi-rs/canvas, Vitest.

---

## Task 1: Refactor templates.ts into individual files

**Files:**
- Create: `src/engine/templates/helpers.ts` — shared drawing helpers
- Create: `src/engine/templates/index.ts` — registry + type exports
- Create: `src/engine/templates/default.ts`
- Create: `src/engine/templates/social-card.ts`
- Create: `src/engine/templates/blog-hero.ts`
- Create: `src/engine/templates/email-banner.ts`
- Modify: `src/engine/templates.ts` — becomes re-export barrel

- [ ] **Step 1:** Read the current `src/engine/templates.ts` fully
- [ ] **Step 2:** Create `src/engine/templates/` directory
- [ ] **Step 3:** Extract shared helpers into `src/engine/templates/helpers.ts`: `hexToRgb`, `rgba`, `paintBackgroundMesh`, `drawBgImage`, `fitTitleLines`
- [ ] **Step 4:** Extract each template into its own file, importing helpers
- [ ] **Step 5:** Create `src/engine/templates/index.ts` with the TEMPLATES registry, type exports
- [ ] **Step 6:** Replace `src/engine/templates.ts` with a re-export barrel:
```typescript
export { TEMPLATES, TEMPLATE_NAMES, getTemplate } from './templates/index';
export type { TemplateFn, TemplateInput, TemplateResult } from './templates/index';
```
- [ ] **Step 7:** Run all tests: `npx vitest run` — must be 168/168 passing (zero behavioral changes)
- [ ] **Step 8:** Commit: `refactor(engine): split templates into individual files`

---

## Task 2: Add product-card template

**Files:**
- Create: `src/engine/templates/product-card.ts`
- Modify: `src/engine/templates/index.ts` (register)
- Modify: `tests/engine/templates.test.ts` (add test)

- [ ] **Step 1:** Write test:
```typescript
it('renders product-card template', async () => {
  const result = await renderCard(defaultOptions({
    template: 'product-card',
    variables: { price: '€129', badge: '-20%', brand: 'Nike' },
  }));
  expect(result.buffer.length).toBeGreaterThan(0);
  expect(result.contentType).toBe('image/png');
});
```
- [ ] **Step 2:** Implement `product-card.ts`: Split layout — left side: brand tag, title (product name), price large bold, badge pill in accent. Right side: product image area (from `namedImages.product`). Falls back to full-width text if no product image.
- [ ] **Step 3:** Register in index.ts
- [ ] **Step 4:** Run tests, commit: `feat(templates): add product-card template`

---

## Task 3: Add event template

**Files:**
- Create: `src/engine/templates/event.ts`
- Modify: `src/engine/templates/index.ts`
- Modify: `tests/engine/templates.test.ts`

- [ ] **Step 1:** Write test:
```typescript
it('renders event template', async () => {
  const result = await renderCard(defaultOptions({
    template: 'event',
    variables: { date: 'June 15, 2026', location: 'Amsterdam', speaker: 'Dan Abramov' },
  }));
  expect(result.buffer.length).toBeGreaterThan(0);
});
```
- [ ] **Step 2:** Implement: Background image with gradient overlay. Title large center-bottom. Date + location horizontal bar. Speaker name. Logo corner.
- [ ] **Step 3:** Register, run tests, commit: `feat(templates): add event template`

---

## Task 4: Add testimonial template

**Files:**
- Create: `src/engine/templates/testimonial.ts`
- Modify: `src/engine/templates/index.ts`
- Modify: `tests/engine/templates.test.ts`

- [ ] **Step 1:** Write test:
```typescript
it('renders testimonial template', async () => {
  const result = await renderCard(defaultOptions({
    template: 'testimonial',
    variables: { quote: 'This product changed our workflow completely.', name: 'Jane Doe', company: 'Acme Corp', role: 'CTO' },
  }));
  expect(result.buffer.length).toBeGreaterThan(0);
});
```
- [ ] **Step 2:** Implement: Large opening quote mark in accent. Quote text centered. Author line below (name, role, company). Avatar circle if available from `namedImages.avatar`.
- [ ] **Step 3:** Register, run tests, commit: `feat(templates): add testimonial template`

---

## Task 5: Add github-repo template

**Files:**
- Create: `src/engine/templates/github-repo.ts`
- Modify: `src/engine/templates/index.ts`
- Modify: `tests/engine/templates.test.ts`

- [ ] **Step 1:** Write test:
```typescript
it('renders github-repo template', async () => {
  const result = await renderCard(defaultOptions({
    template: 'github-repo',
    variables: { owner: 'vercel', stars: '12.4k', language: 'TypeScript' },
  }));
  expect(result.buffer.length).toBeGreaterThan(0);
});
```
- [ ] **Step 2:** Implement: Dark forced gradient. Owner/name at top (monospace or bold). Description below. Bottom bar: colored language dot + star count. Avatar circle for owner.
- [ ] **Step 3:** Register, run tests, commit: `feat(templates): add github-repo template`

---

## Task 6: Add news-article template

**Files:**
- Create: `src/engine/templates/news-article.ts`
- Modify: `src/engine/templates/index.ts`
- Modify: `tests/engine/templates.test.ts`

- [ ] **Step 1:** Write test, **Step 2:** Implement: Full-bleed background with strong bottom gradient. Category pill. Large title. Source + date at bottom. Logo corner. **Step 3:** Register, test, commit: `feat(templates): add news-article template`

---

## Task 7: Add pricing template

**Files:**
- Create: `src/engine/templates/pricing.ts`
- Modify: `src/engine/templates/index.ts`
- Modify: `tests/engine/templates.test.ts`

- [ ] **Step 1:** Write test with variables: `plan`, `price`, `period`, `features` (comma-separated), `cta`
- [ ] **Step 2:** Implement: Centered card. Plan name in accent at top. Large price. Feature list with check marks. CTA button. Logo at top.
- [ ] **Step 3:** Register, test, commit: `feat(templates): add pricing template`

---

## Task 8: Add profile-card template

**Files:**
- Create: `src/engine/templates/profile-card.ts`
- Modify: `src/engine/templates/index.ts`
- Modify: `tests/engine/templates.test.ts`

- [ ] **Step 1:** Write test with variables: `name`, `role`, `company`, `bio`
- [ ] **Step 2:** Implement: Large avatar circle. Name large below. Role + company muted. Bio as body text. Company logo small in corner.
- [ ] **Step 3:** Register, test, commit: `feat(templates): add profile-card template`

---

## Task 9: Add announcement template

**Files:**
- Create: `src/engine/templates/announcement.ts`
- Modify: `src/engine/templates/index.ts`
- Modify: `tests/engine/templates.test.ts`

- [ ] **Step 1:** Write test with variables: `subtitle`, `cta`
- [ ] **Step 2:** Implement: Dramatic. Background with heavy overlay. Tag pill. Title very large centered. Subtitle. CTA button in accent. Logo corner.
- [ ] **Step 3:** Register, test, commit: `feat(templates): add announcement template`

---

## Task 10: Final verification + update health endpoint

- [ ] **Step 1:** Run full test suite
- [ ] **Step 2:** Verify `/health` endpoint now lists all 12 templates
- [ ] **Step 3:** Commit any fixes
