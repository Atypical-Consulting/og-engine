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
  it('exports 4 templates', () => {
    expect(TEMPLATE_NAMES).toEqual(['default', 'social-card', 'blog-hero', 'email-banner']);
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
});
