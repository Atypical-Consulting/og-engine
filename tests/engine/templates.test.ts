import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerFonts } from '../../src/engine/fonts';
import { type RenderOptions, renderCard } from '../../src/engine/renderer';
import { getTemplate, TEMPLATE_NAMES, TEMPLATES } from '../../src/engine/templates';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

function opts(template: string): RenderOptions {
  return {
    title: 'Template Test Title',
    description: 'A description for testing templates.',
    author: 'Test Author',
    tag: 'Testing',
    format: 'og',
    template,
    accent: '#38ef7d',
    layout: 'left',
    titleSize: 48,
    descSize: 22,
    fontName: 'Outfit',
    gradient: 'void',
    bgImageBuffer: null,
    overlayOpacity: 0.65,
    autoFit: false,
    outputFormat: 'png',
    outputQuality: 90,
  };
}

describe('template registry', () => {
  it('exports 12 templates', () => {
    expect(TEMPLATE_NAMES).toEqual([
      'default',
      'social-card',
      'blog-hero',
      'email-banner',
      'event',
      'github-repo',
      'product-card',
      'testimonial',
      'news-article',
      'pricing',
      'profile-card',
      'announcement',
    ]);
  });

  it('getTemplate returns default for unknown name', () => {
    const fn = getTemplate('unknown');
    expect(fn).toBe(TEMPLATES.default);
  });
});

describe('each template renders correctly', () => {
  for (const name of TEMPLATE_NAMES) {
    it(`renders "${name}" template to valid PNG`, async () => {
      const result = await renderCard(opts(name));
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.buffer[0]).toBe(0x89); // PNG
      expect(result.width).toBe(1200);
      expect(result.height).toBe(630);
      expect(result.titleVisibleLines).toBeGreaterThan(0);
    });
  }

  it('social-card reports 0 description lines', async () => {
    const result = await renderCard(opts('social-card'));
    expect(result.descTotalLines).toBe(0);
    expect(result.descVisibleLines).toBe(0);
  });

  it('email-banner limits title to 2 lines', async () => {
    const result = await renderCard({
      ...opts('email-banner'),
      title:
        'This is a very long title for an email banner that should be limited to two lines maximum for a clean horizontal layout',
    });
    expect(result.titleVisibleLines).toBeLessThanOrEqual(2);
  });

  it('renders event template', async () => {
    const result = await renderCard({
      ...opts('event'),
      variables: { date: 'June 15, 2026', location: 'Amsterdam', speaker: 'Dan Abramov' },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.buffer[0]).toBe(0x89); // PNG magic byte
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.titleVisibleLines).toBeGreaterThan(0);
    expect(result.descTotalLines).toBe(0);
    expect(result.overflow).toBe(false);
  });

  it('renders github-repo template', async () => {
    const result = await renderCard({
      ...opts('github-repo'),
      title: 'vercel/next.js',
      variables: { owner: 'vercel', stars: '12.4k', language: 'TypeScript' },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.buffer[0]).toBe(0x89); // PNG magic byte
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.titleVisibleLines).toBeGreaterThan(0);
  });

  it('renders product-card template', async () => {
    const result = await renderCard({
      ...opts('product-card'),
      title: 'Air Max 270',
      variables: { price: '€129', badge: '-20%', brand: 'Nike' },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.buffer[0]).toBe(0x89); // PNG magic byte
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.titleVisibleLines).toBeGreaterThan(0);
    expect(result.descTotalLines).toBe(0);
    expect(result.descVisibleLines).toBe(0);
  });

  it('renders testimonial template', async () => {
    const result = await renderCard({
      ...opts('testimonial'),
      variables: { quote: 'This changed our workflow.', name: 'Jane Doe', company: 'Acme Corp', role: 'CTO' },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.buffer[0]).toBe(0x89); // PNG magic byte
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.titleVisibleLines).toBeGreaterThan(0);
    expect(result.descTotalLines).toBe(0);
    expect(result.descVisibleLines).toBe(0);
  });

  it('renders news-article template', async () => {
    const result = await renderCard({
      ...opts('news-article'),
      variables: { source: 'TechCrunch', date: 'April 10, 2026', category: 'AI' },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('renders pricing template', async () => {
    const result = await renderCard({
      ...opts('pricing'),
      variables: {
        plan: 'Pro',
        price: '€39',
        period: '/mo',
        features: 'Unlimited renders,Priority support,Custom templates',
        cta: 'Start Free Trial',
      },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('renders profile-card template', async () => {
    const result = await renderCard({
      ...opts('profile-card'),
      variables: { name: 'Jane Doe', role: 'CTO', company: 'Acme Corp', bio: 'Building the future of tech.' },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('renders announcement template', async () => {
    const result = await renderCard({
      ...opts('announcement'),
      variables: { subtitle: 'The fastest image API just got faster.', cta: 'Try It Free' },
    });
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
