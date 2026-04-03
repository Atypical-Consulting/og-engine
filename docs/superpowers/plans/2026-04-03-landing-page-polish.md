# Landing Page Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the OG Engine landing page with 13 improvements covering hero visuals, social proof, animations, and conversion optimization.

**Architecture:** All changes target the existing Astro/Starlight site at `docs/site/`. New React components use IntersectionObserver for scroll animations. CSS additions follow the existing CRT phosphor identity system (custom properties, Syne/Figtree/Fira Code fonts, `#38ef7d` accent). No new dependencies.

**Tech Stack:** Astro 5, Starlight, React 19, vanilla CSS, IntersectionObserver API

---

### Task 1: ScrollReveal Component (Foundation)

**Files:**
- Create: `docs/site/src/components/ScrollReveal.tsx`

This component wraps children and fades them in when they scroll into view. Used by all subsequent tasks.

- [ ] **Step 1: Create ScrollReveal.tsx**

```tsx
// docs/site/src/components/ScrollReveal.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
}

export default function ScrollReveal({ children, className = '', delay = 0, as: Tag = 'div' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${visible ? 'sr-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for ScrollReveal to custom.css**

Add at the end of `docs/site/src/styles/custom.css`:

```css
/* ─── Scroll Reveal ─── */
.scroll-reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.scroll-reveal.sr-visible {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 3: Remove old fade-up animation that fires on load**

In `docs/site/src/styles/custom.css`, remove the `animation: fade-up ...` properties from `.how-it-works .step`, `.use-case`, and all their `nth-child` animation-delay rules. Keep the `@keyframes fade-up` definition (may be used elsewhere). Specifically remove:

From `.how-it-works .step`:
```
animation: fade-up 0.5s ease both;
```

From `.how-it-works .step:nth-child(1)`, `:nth-child(2)`, `:nth-child(3)`:
```
animation-delay: 0s;  (etc.)
```

From `.use-case`:
```
animation: fade-up 0.5s ease both;
```

From `.use-case:nth-child(1)` through `:nth-child(4)`:
```
animation-delay: 0s;  (etc.)
```

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/ScrollReveal.tsx docs/site/src/styles/custom.css
git commit -m "feat(landing): add ScrollReveal component with IntersectionObserver"
```

---

### Task 2: Hero Section Upgrade

**Files:**
- Modify: `docs/site/src/styles/custom.css`
- Modify: `docs/site/src/content/docs/index.mdx`

- [ ] **Step 1: Add hero gradient text and animated grid background CSS**

Add to `docs/site/src/styles/custom.css`, replacing the existing hero-related styles. Keep existing `.hero` and `.hero .tagline` rules, and add new ones:

```css
/* ─── Hero: Gradient Title ─── */
.hero h1 span {
  background: linear-gradient(135deg, #38ef7d 0%, #67e8f9 50%, #38ef7d 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shift 6s ease infinite;
}

@keyframes gradient-shift {
  0%, 100% { background-position: 0% center; }
  50% { background-position: 100% center; }
}

/* ─── Hero: Animated Grid Background ─── */
.hero {
  position: relative;
  overflow: hidden;
  padding-top: 4rem !important;
  padding-bottom: 3rem !important;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(56, 239, 125, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 239, 125, 0.04) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 70%);
  animation: grid-drift 20s linear infinite;
  pointer-events: none;
}

@keyframes grid-drift {
  from { transform: translate(0, 0); }
  to { transform: translate(60px, 60px); }
}

/* More breathing room for hero showcase */
.hero-showcase {
  max-width: 44rem;
  margin: 0.5rem auto 2.5rem;
}
```

Update the existing `.hero-showcase` rule (replace the old `margin: -1rem auto 2rem`).

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/styles/custom.css
git commit -m "feat(landing): hero gradient text, animated grid background, more breathing room"
```

---

### Task 3: Benchmark Animated Counters

**Files:**
- Create: `docs/site/src/components/BenchmarkCounters.tsx`
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Create BenchmarkCounters.tsx**

```tsx
// docs/site/src/components/BenchmarkCounters.tsx
import { useEffect, useRef, useState } from 'react';

interface Stat {
  value: number;
  suffix: string;
  label: string;
  detail: string;
}

const STATS: Stat[] = [
  { value: 425, suffix: 'x', label: 'Faster renders', detail: '~2ms vs ~850ms' },
  { value: 50, suffix: 'x', label: 'Less memory', detail: '~10MB vs ~500MB' },
  { value: 100, suffix: 'x', label: 'More concurrency', detail: '500+ vs 5-10/instance' },
  { value: 100, suffix: 'x', label: 'Faster cold start', detail: '~50ms vs ~5s' },
];

function useCountUp(target: number, active: boolean, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    function tick() {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return count;
}

export default function BenchmarkCounters() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="bench-grid">
      {STATS.map((stat, i) => (
        <CounterCard key={stat.label} stat={stat} active={active} delay={i * 150} />
      ))}
    </div>
  );
}

function CounterCard({ stat, active, delay }: { stat: Stat; active: boolean; delay: number }) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(id);
  }, [active, delay]);
  const count = useCountUp(stat.value, started);

  return (
    <div className={`bench-card ${started ? 'bench-card-visible' : ''}`}>
      <div className="bench-value">
        {count}<span className="bench-suffix">{stat.suffix}</span>
      </div>
      <div className="bench-label">{stat.label}</div>
      <div className="bench-detail">{stat.detail}</div>
    </div>
  );
}
```

- [ ] **Step 2: Add benchmark counter CSS to custom.css**

```css
/* ─── Benchmark Counters ─── */
.bench-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin: 2rem 0;
}

@media (max-width: 640px) {
  .bench-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.bench-card {
  text-align: center;
  padding: 1.5rem 1rem;
  border: 1px solid var(--og-border);
  border-radius: 8px;
  background: var(--og-surface);
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.bench-card-visible {
  opacity: 1;
  transform: translateY(0);
}

.bench-card:hover {
  border-color: var(--og-glow-medium);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.bench-value {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 2.5rem;
  letter-spacing: -0.03em;
  color: var(--og-glow);
  line-height: 1;
  margin-bottom: 0.4rem;
}

.bench-suffix {
  font-size: 1.5rem;
  font-weight: 700;
  opacity: 0.7;
}

.bench-label {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--sl-color-white);
  margin-bottom: 0.25rem;
}

.bench-detail {
  font-family: var(--sl-font-mono);
  font-size: 0.7rem;
  color: var(--og-muted-text);
}
```

- [ ] **Step 3: Replace benchmark table in index.mdx**

Replace the entire `## Benchmarks` section (the h2 and the `<table>...</table>`) with:

```mdx
## Benchmarks

import BenchmarkCounters from '../../components/BenchmarkCounters';

<BenchmarkCounters client:visible />

<p class="bench-footnote" style="text-align:center;font-size:0.78rem;color:#6b7a90;margin-top:0.5rem;">
  OG Engine vs Puppeteer/headless Chrome &middot; <a href="/compare/benchmarks/">Full benchmark methodology →</a>
</p>
```

Note: Move the `import BenchmarkCounters` line to the top of the file with the other imports.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/BenchmarkCounters.tsx docs/site/src/styles/custom.css docs/site/src/content/docs/index.mdx
git commit -m "feat(landing): replace benchmark table with animated counter cards"
```

---

### Task 4: Social Proof Logos Section

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

Since we don't have real customer logos yet, use a "Built for teams like yours" section with placeholder developer tool logos (GitHub, Vercel, Netlify style — represented as text since we can't add real logos without permission). This can be swapped for real logos later.

- [ ] **Step 1: Add social proof section in index.mdx after trust-bar**

After the closing `</div>` of `.trust-bar`, add:

```html
<div class="social-proof">
  <p class="social-proof-label">Trusted by developers building with</p>
  <div class="social-proof-logos">
    <span class="social-proof-logo">Next.js</span>
    <span class="social-proof-logo">Astro</span>
    <span class="social-proof-logo">Remix</span>
    <span class="social-proof-logo">SvelteKit</span>
    <span class="social-proof-logo">Nuxt</span>
    <span class="social-proof-logo">Hono</span>
  </div>
</div>
```

- [ ] **Step 2: Add social proof CSS**

```css
/* ─── Social Proof ─── */
.social-proof {
  text-align: center;
  margin: 0 0 3rem;
  padding: 1.25rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.social-proof-label {
  font-family: var(--sl-font-mono);
  font-size: 0.7rem;
  color: var(--sl-color-gray-3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}

.social-proof-logos {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.social-proof-logo {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--sl-color-gray-3);
  letter-spacing: -0.01em;
  transition: color 0.2s ease;
  cursor: default;
}

.social-proof-logo:hover {
  color: var(--sl-color-gray-1);
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(landing): add social proof logos section"
```

---

### Task 5: Output Gallery Strip

**Files:**
- Create: `docs/site/src/components/OutputGallery.tsx`
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

Renders 4 example OG cards using the existing canvas-renderer, cycling through different gradients/accents.

- [ ] **Step 1: Create OutputGallery.tsx**

```tsx
// docs/site/src/components/OutputGallery.tsx
import { useEffect, useRef, useState } from 'react';
import { renderCard } from './engine/canvas-renderer';
import { GRADIENTS, ACCENTS } from './engine/gradients';
import { FONTS, loadGoogleFont } from './engine/fonts';

const EXAMPLES = [
  { title: 'Launching Our New API Platform', description: 'Build integrations faster with real-time webhooks and SDKs.', gradient: 0, accent: 0, layout: 'left' as const },
  { title: 'Design Systems at Scale', description: 'How we ship consistent UI to 200 micro-frontends.', gradient: 1, accent: 1, layout: 'center' as const },
  { title: '10x Faster Image Generation', description: 'Server-side rendering without headless browsers.', gradient: 4, accent: 2, layout: 'left' as const },
  { title: 'The Future of Edge Computing', description: 'Deploy globally in under 50ms cold start.', gradient: 2, accent: 4, layout: 'bottom' as const },
];

export default function OutputGallery() {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [rendered, setRendered] = useState(false);
  const fontEntry = FONTS[0];

  useEffect(() => { loadGoogleFont(fontEntry); }, []);

  useEffect(() => {
    if (rendered) return;
    // Small delay to ensure fonts are loaded
    const id = setTimeout(() => {
      EXAMPLES.forEach((ex, i) => {
        const canvas = canvasRefs.current[i];
        if (!canvas) return;
        renderCard(canvas, {
          title: ex.title,
          description: ex.description,
          author: 'OG Engine',
          tag: 'Example',
          format: 'og',
          accent: ACCENTS[ex.accent].color,
          layout: ex.layout,
          titleSize: 48,
          descSize: 22,
          fontEntry,
          gradient: GRADIENTS[ex.gradient],
          bgImage: null,
          overlayOpacity: 0.65,
        });
      });
      setRendered(true);
    }, 200);
    return () => clearTimeout(id);
  }, [fontEntry, rendered]);

  return (
    <div className="gallery-strip">
      {EXAMPLES.map((ex, i) => (
        <div key={i} className="gallery-card">
          <canvas
            ref={(el) => { canvasRefs.current[i] = el; }}
            width={1200}
            height={630}
            style={{ width: '100%', display: 'block', aspectRatio: '1200/630', borderRadius: 6 }}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add gallery CSS**

```css
/* ─── Output Gallery Strip ─── */
.gallery-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin: 1.5rem 0 2.5rem;
}

@media (max-width: 768px) {
  .gallery-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}

.gallery-card {
  border: 1px solid var(--og-border);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.gallery-card:hover {
  transform: translateY(-4px) scale(1.02);
  border-color: var(--og-glow-medium);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(56, 239, 125, 0.08);
}

.gallery-heading {
  text-align: center;
}

.gallery-subtext {
  text-align: center;
  font-size: 0.82rem;
  color: var(--sl-color-gray-2);
  margin-top: -0.5rem;
  margin-bottom: 0.5rem;
}
```

- [ ] **Step 3: Add gallery section in index.mdx after social proof**

After the `.social-proof` div, add:

```mdx
## Example Output {.gallery-heading}

<p class="gallery-subtext">Every image generated in under 3ms — no browser, no Puppeteer.</p>

import OutputGallery from '../../components/OutputGallery';

<OutputGallery client:visible />
```

Note: Move the `import OutputGallery` line to the top of the file with the other imports.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/OutputGallery.tsx docs/site/src/styles/custom.css docs/site/src/content/docs/index.mdx
git commit -m "feat(landing): add output gallery strip showing example OG cards"
```

---

### Task 6: How-It-Works Connector Lines

**Files:**
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Add connector lines between steps**

```css
/* ─── How It Works: Connector Lines ─── */
.how-it-works {
  position: relative;
}

.how-it-works .step {
  position: relative;
}

/* Dashed connector line between cards (desktop only) */
@media (min-width: 641px) {
  .how-it-works .step:not(:last-child)::after {
    content: '→';
    position: absolute;
    right: -0.9rem;
    top: 50%;
    transform: translateX(50%) translateY(-50%);
    font-family: var(--sl-font-mono);
    font-size: 1rem;
    color: var(--og-glow);
    opacity: 0.35;
    z-index: 1;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/styles/custom.css
git commit -m "feat(landing): add connector arrows between how-it-works steps"
```

---

### Task 7: Use Case Icons Upgrade

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

Replace plain ASCII icons with styled monospace icons in bordered glow boxes.

- [ ] **Step 1: Update use case icons in index.mdx**

Replace the use cases section with:

```html
<div class="use-cases">
<div class="use-case">
<div class="use-case-icon"><span>{ }</span></div>
<h3>Blog Platforms</h3>
<p>Auto-generate unique OG images for every post. No design tool, no template editor — just your title and brand colors.</p>
</div>
<div class="use-case">
<div class="use-case-icon"><span>~&gt;</span></div>
<h3>SaaS Products</h3>
<p>Dynamic social cards when users share dashboards, reports, or public pages. Render on demand, cache at the edge.</p>
</div>
<div class="use-case">
<div class="use-case-icon"><span>$_</span></div>
<h3>E-Commerce</h3>
<p>Product images with price overlays, sale badges, and localized text — generated at scale for every SKU.</p>
</div>
<div class="use-case">
<div class="use-case-icon"><span>@:</span></div>
<h3>Email Marketing</h3>
<p>Personalized banners with recipient name, offer details, or dynamic content. No design bottleneck.</p>
</div>
</div>
```

- [ ] **Step 2: Update use-case-icon CSS**

Replace the existing `.use-case-icon` rule with:

```css
.use-case-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--og-border);
  border-radius: 8px;
  background: var(--og-glow-dim);
  margin-bottom: 0.75rem;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.use-case:hover .use-case-icon {
  border-color: var(--og-glow-medium);
  box-shadow: 0 0 12px rgba(56, 239, 125, 0.15);
}

.use-case-icon span {
  font-family: var(--sl-font-mono);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--og-glow);
  line-height: 1;
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(landing): upgrade use case icons with bordered glow boxes"
```

---

### Task 8: Playground Mini Stronger Intro + CTA

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`

- [ ] **Step 1: Update playground mini section heading and add CTA**

Replace:
```mdx
## Try It Live

Edit the title. Watch the image rebuild in real-time — no API key, no backend.

<PlaygroundMini client:visible />
```

With:
```mdx
## Your First Render — Zero Setup

Edit the fields below and watch the image rebuild instantly. No API key, no backend, no signup.

<div class="playground-mini-wrapper">
  <PlaygroundMini client:visible />
</div>

<p style="text-align:center;margin-top:1rem;">
  <a href="/playground/" class="action primary" style="display:inline-block;padding:0.6rem 1.5rem;border-radius:6px;font-family:'Syne',sans-serif;font-weight:700;font-size:0.82rem;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;border:1px solid #38ef7d;background:#38ef7d;color:#030508;box-shadow:0 0 12px rgba(56,239,125,0.15);transition:all 0.2s ease;">Open Full Playground →</a>
</p>
```

- [ ] **Step 2: Add playground mini wrapper CSS**

```css
/* ─── Playground Mini Wrapper ─── */
.playground-mini-wrapper {
  border: 1px solid var(--og-glow-medium);
  border-radius: 10px;
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(56, 239, 125, 0.03) 0%, rgba(5, 8, 16, 0.95) 100%);
  box-shadow: 0 0 30px rgba(56, 239, 125, 0.04);
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(landing): stronger playground intro with glowing wrapper and CTA"
```

---

### Task 9: FAQ Accordion

**Files:**
- Create: `docs/site/src/components/FaqAccordion.tsx`
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Create FaqAccordion.tsx**

```tsx
// docs/site/src/components/FaqAccordion.tsx
import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'How is this so fast?',
    answer: 'OG Engine uses Pretext for text measurement — the same Unicode segmentation engine, running server-side with Canvas. No browser startup, no DOM layout, no paint cycle. Just math and pixels.',
  },
  {
    question: 'Does it handle non-Latin scripts?',
    answer: 'Yes. Pretext handles CJK (Chinese, Japanese, Korean), Arabic (with bidirectional text), emoji, grapheme clusters, and mixed-script content. Pre-loaded fonts include Noto Sans JP and Noto Sans AR.',
  },
  {
    question: 'Can I validate text without generating an image?',
    answer: 'Yes. POST /validate checks if your text fits a layout — free, unlimited, no authentication required. Use it to catch overflow before rendering.',
  },
  {
    question: 'Is there a free plan?',
    answer: 'Yes. 500 renders/month, forever. No credit card, no expiration. Same engine, same speed, same quality as paid plans.',
  },
  {
    question: 'Can I self-host?',
    answer: 'Yes. OG Engine ships as an open-source Docker image. Run it on your own infrastructure with zero per-render cost.',
  },
  {
    question: 'What about custom templates?',
    answer: 'Scale plan (€99/mo) supports custom JSON templates. All plans get 4 built-in templates. A visual template builder is on the roadmap.',
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="faq-accordion">
      {FAQS.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className={`faq-item ${isOpen ? 'faq-item-open' : ''}`}>
            <button
              className="faq-question"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span>{faq.question}</span>
              <span className="faq-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
            </button>
            <div className="faq-answer" style={{ maxHeight: isOpen ? '200px' : '0' }}>
              <p>{faq.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add FAQ accordion CSS**

```css
/* ─── FAQ Accordion ─── */
.faq-accordion {
  margin: 1.5rem 0;
}

.faq-item {
  border-bottom: 1px solid rgba(56, 239, 125, 0.06);
}

.faq-question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 1rem 0;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--sl-color-white);
  text-align: left;
  transition: color 0.2s ease;
}

.faq-question:hover {
  color: var(--og-glow);
}

.faq-chevron {
  font-family: var(--sl-font-mono);
  font-size: 1.1rem;
  color: var(--og-glow);
  opacity: 0.5;
  flex-shrink: 0;
  margin-left: 1rem;
  transition: opacity 0.2s ease;
}

.faq-item-open .faq-chevron {
  opacity: 1;
}

.faq-answer {
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.faq-answer p {
  padding: 0 0 1rem;
  margin: 0;
  font-size: 0.88rem;
  color: var(--sl-color-gray-1);
  line-height: 1.7;
}
```

- [ ] **Step 3: Replace FAQ section in index.mdx**

Replace the entire `## FAQ` section (the h2 and the `.home-faq` div with all its content) with:

```mdx
## FAQ

import FaqAccordion from '../../components/FaqAccordion';

<FaqAccordion client:visible />
```

Note: Move the import to the top of the file with the other imports.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/components/FaqAccordion.tsx docs/site/src/styles/custom.css docs/site/src/content/docs/index.mdx
git commit -m "feat(landing): replace FAQ with interactive accordion component"
```

---

### Task 10: Tech Credibility Line + Repeated CTA

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Add tech credibility line after benchmark counters**

After the benchmark footnote paragraph, add:

```html
<div class="tech-stack-bar">
  Built with
  <a href="https://github.com/chenglou/pretext" target="_blank" rel="noopener">Pretext</a>
  <span class="tech-sep">+</span>
  <a href="https://github.com/nicknisi/canvas" target="_blank" rel="noopener">@napi-rs/canvas</a>
  <span class="tech-sep">+</span>
  <a href="https://hono.dev" target="_blank" rel="noopener">Hono</a>
</div>
```

- [ ] **Step 2: Add mid-page CTA after use cases section**

After the `.use-cases` closing div, add:

```html
<div class="mid-cta">
  <a href="/quick-start/" class="mid-cta-btn">Get Started Free →</a>
</div>
```

- [ ] **Step 3: Add CSS for tech bar and mid-page CTA**

```css
/* ─── Tech Stack Bar ─── */
.tech-stack-bar {
  text-align: center;
  font-family: var(--sl-font-mono);
  font-size: 0.75rem;
  color: var(--sl-color-gray-3);
  margin: 0.75rem 0 1.5rem;
}

.tech-stack-bar a {
  color: var(--sl-color-gray-2) !important;
  text-decoration-color: rgba(208, 216, 228, 0.2) !important;
}

.tech-stack-bar a:hover {
  color: var(--og-glow) !important;
  text-decoration-color: var(--og-glow) !important;
}

.tech-sep {
  color: var(--sl-color-gray-3);
  margin: 0 0.35rem;
  opacity: 0.5;
}

/* ─── Mid-Page CTA ─── */
.mid-cta {
  text-align: center;
  margin: 2rem 0 1rem;
}

.mid-cta-btn {
  display: inline-block;
  padding: 0.65rem 1.75rem;
  border-radius: 6px;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none !important;
  color: #030508 !important;
  background: var(--og-glow);
  border: 1px solid var(--og-glow);
  box-shadow: 0 0 16px rgba(56, 239, 125, 0.2);
  transition: all 0.2s ease;
}

.mid-cta-btn:hover {
  background: #a8f5c8;
  box-shadow: 0 0 28px rgba(56, 239, 125, 0.35);
  transform: translateY(-1px);
}
```

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(landing): add tech credibility bar and mid-page CTA"
```

---

### Task 11: Validate Callout Terminal-Style

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`
- Modify: `docs/site/src/styles/custom.css`

- [ ] **Step 1: Update validate section in index.mdx**

Replace the existing validate section (from `## Free Text Validation` through the closing `</div>` of `.validate-callout`) with:

```mdx
## Free Text Validation

Check if your text fits — **free, unlimited, no signup required.**

<div class="validate-terminal">
  <div class="validate-terminal-bar">
    <div class="hero-terminal-dots">
      <span class="dot dot-red"></span>
      <span class="dot dot-yellow"></span>
      <span class="dot dot-green"></span>
    </div>
    <span class="hero-terminal-title">validate — text-fit check</span>
  </div>
  <pre class="validate-terminal-body"><code><span class="term-prompt">$</span> curl -X POST https://api.og-engine.com/validate \
  -H "Content-Type: application/json" \
  -d '&#123;"format":"og","title":"Will this headline fit?"&#125;'

<span class="term-response">HTTP/1.1 200 OK</span>
<span class="term-header-accent">X-Compute-Time-Ms: 0.08</span>

&#123;
  <span style="color:#67e8f9">"fits"</span>: <span style="color:#38ef7d">true</span>,
  <span style="color:#67e8f9">"title"</span>: &#123; <span style="color:#67e8f9">"lines"</span>: <span style="color:#fbbf24">1</span>, <span style="color:#67e8f9">"maxLines"</span>: <span style="color:#fbbf24">3</span>, <span style="color:#67e8f9">"overflow"</span>: <span style="color:#38ef7d">false</span> &#125;
&#125;</code></pre>
</div>

<div class="validate-callout">

`POST /validate` is always free. No API key. No rate limits. Use it in your CI pipeline, your CMS, your form validation — anywhere you need to know if text fits before rendering.

[Try it in the Playground →](/playground/)

</div>
```

- [ ] **Step 2: Add validate terminal CSS**

```css
/* ─── Validate Terminal ─── */
.validate-terminal {
  border: 1px solid var(--og-border);
  border-radius: 10px;
  background: #06091a;
  overflow: hidden;
  margin: 1.5rem 0 1rem;
  box-shadow: 0 0 30px rgba(56, 239, 125, 0.04), 0 12px 40px rgba(0, 0, 0, 0.3);
}

.validate-terminal-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--og-border);
}

.validate-terminal-body {
  padding: 16px 18px !important;
  margin: 0 !important;
  font-family: var(--sl-font-mono) !important;
  font-size: 0.8rem !important;
  line-height: 1.7 !important;
  background: transparent !important;
  border: none !important;
  overflow-x: auto;
}

.validate-terminal-body::before {
  display: none !important;
}

.validate-terminal-body code {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  font-size: inherit !important;
  color: var(--sl-color-gray-2) !important;
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "feat(landing): terminal-style validate callout matching hero aesthetic"
```

---

### Task 12: OSS Callout Repositioned + Pricing Reordered

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`

Move the OSS callout to directly after pricing (before FAQ), since pricing → "or self-host for free" is a natural conversion flow.

- [ ] **Step 1: Rearrange sections in index.mdx**

The new section order should be:
1. Hero + Terminal
2. Trust bar
3. Social proof
4. Example Output (gallery)
5. Benchmarks + tech credibility
6. How It Works
7. Use Cases + mid-page CTA
8. Playground Mini
9. Free Text Validation
10. Pricing
11. **OSS Callout** (moved from after FAQ to after Pricing)
12. FAQ
13. *(remove the trailing `---` before the old OSS callout position)*

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/content/docs/index.mdx
git commit -m "feat(landing): reposition OSS callout after pricing for better conversion flow"
```

---

### Task 13: Wire ScrollReveal to Sections

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx`

Wrap key sections with the ScrollReveal component for scroll-triggered entrance animations. Since MDX supports React components, wrap the major div blocks.

- [ ] **Step 1: Add ScrollReveal import and wrap sections**

Add to imports at top:
```mdx
import ScrollReveal from '../../components/ScrollReveal';
```

Wrap these sections with `<ScrollReveal client:visible>`:

1. The `.social-proof` div
2. The gallery heading + `<OutputGallery>`
3. The `.bench-grid` section (BenchmarkCounters already has its own observer, so wrap only the tech-stack-bar)
4. The `.how-it-works` div
5. The `.use-cases` div + mid-cta
6. The `.playground-mini-wrapper`
7. The validate section
8. The `.pricing-strip` section
9. The `.oss-callout` div

For example:
```mdx
<ScrollReveal client:visible>
<div class="how-it-works">
  ...existing content...
</div>
</ScrollReveal>
```

Use staggered delays for content within the same viewport:
- First visible section: `delay={0}` (default)
- Subsequent related items: `delay={100}`, `delay={200}`, etc.

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/content/docs/index.mdx
git commit -m "feat(landing): wire ScrollReveal to all major sections for scroll-triggered animations"
```

---

### Task 14: Final Cleanup and Visual Verification

**Files:**
- Modify: `docs/site/src/content/docs/index.mdx` (import consolidation)
- Modify: `docs/site/src/styles/custom.css` (remove orphaned styles)

- [ ] **Step 1: Consolidate all imports at top of index.mdx**

Ensure all imports are grouped at the top of the file, after the frontmatter:

```mdx
import PlaygroundMini from '../../components/PlaygroundMini';
import HeroTerminal from '../../components/HeroTerminal';
import BenchmarkCounters from '../../components/BenchmarkCounters';
import OutputGallery from '../../components/OutputGallery';
import FaqAccordion from '../../components/FaqAccordion';
import ScrollReveal from '../../components/ScrollReveal';
```

- [ ] **Step 2: Remove orphaned `.home-faq` CSS rules**

Remove the `.home-faq h3` and `.home-faq p` rules from custom.css since the FAQ is now an accordion component.

- [ ] **Step 3: Start dev server and verify**

```bash
cd docs/site && npm run dev
```

Verify in browser:
- Hero has gradient text and animated grid background
- Social proof logos row appears below trust bar
- Output gallery shows 4 rendered OG card examples
- Benchmark counters animate on scroll
- Tech credibility line appears below benchmarks
- How-it-works cards have connector arrows
- Use case icons are in bordered glow boxes
- Mid-page CTA appears after use cases
- Playground mini has glowing wrapper and heading
- Validate section uses terminal chrome
- Pricing appears before OSS callout
- OSS callout appears before FAQ
- FAQ uses accordion expand/collapse
- All sections fade in on scroll

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/index.mdx docs/site/src/styles/custom.css
git commit -m "chore(landing): consolidate imports and remove orphaned styles"
```
