import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerFonts } from '../../src/engine/fonts';
import { type RenderOptions, renderCard } from '../../src/engine/renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

function defaultOptions(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return {
    title: 'Hello, OG Engine',
    description: 'Generated in ~22ms, no browser needed.',
    author: 'Test Author',
    tag: 'Test',
    format: 'og',
    template: 'default',
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
    ...overrides,
  };
}

describe('renderCard', () => {
  it('returns a PNG buffer for default OG format', async () => {
    const result = await renderCard(defaultOptions());
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    // PNG magic bytes: 0x89 P N G
    expect(result.buffer[0]).toBe(0x89);
    expect(result.buffer[1]).toBe(0x50);
    expect(result.buffer[2]).toBe(0x4e);
    expect(result.buffer[3]).toBe(0x47);
  });

  it('returns render metadata', async () => {
    const result = await renderCard(defaultOptions());
    expect(result.titleTotalLines).toBeGreaterThan(0);
    expect(result.titleVisibleLines).toBeGreaterThan(0);
    expect(typeof result.overflow).toBe('boolean');
  });

  it('produces correct dimensions (1200x630 for OG)', async () => {
    const result = await renderCard(defaultOptions());
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
  });

  it('renders all 5 formats without error', async () => {
    for (const format of ['og', 'twitter', 'square', 'linkedin', 'story'] as const) {
      const result = await renderCard(defaultOptions({ format }));
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  });

  it('renders all 3 layouts without error', async () => {
    for (const layout of ['left', 'center', 'bottom'] as const) {
      const result = await renderCard(defaultOptions({ layout }));
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  });

  it('detects overflow for extremely long title (even after auto-shrink)', async () => {
    // The title renderer auto-shrinks the font to fit when possible. We need a
    // title long enough that even the minimum shrunk size cannot fit within the
    // format's maxTitleLines, so overflow is reported.
    const result = await renderCard(
      defaultOptions({
        title:
          'This is an extraordinarily long title that will certainly overflow the maximum number of lines allowed for the OG format even after auto-shrink because there is simply too much text here to possibly fit into the three lines of title text that the OG format permits regardless of how small we make the typography',
      }),
    );
    expect(result.overflow).toBe(true);
    expect(result.titleTotalLines).toBeGreaterThan(result.titleVisibleLines);
  });

  it('handles missing optional fields', async () => {
    const result = await renderCard(
      defaultOptions({
        description: '',
        author: '',
        tag: '',
      }),
    );
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});

describe('renderCard templates', () => {
  it('renders social-card template', async () => {
    const result = await renderCard(defaultOptions({ template: 'social-card' }));
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.contentType).toBe('image/png');
  });

  it('renders blog-hero template', async () => {
    const result = await renderCard(defaultOptions({ template: 'blog-hero' }));
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('renders email-banner template', async () => {
    const result = await renderCard(defaultOptions({ template: 'email-banner' }));
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('falls back to default for unknown template', async () => {
    const result = await renderCard(defaultOptions({ template: 'nonexistent' }));
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});

describe('renderCard WebP output', () => {
  it('returns WebP buffer when outputFormat is webp', async () => {
    const result = await renderCard(defaultOptions({ outputFormat: 'webp' }));
    expect(result.contentType).toBe('image/webp');
    expect(result.buffer.length).toBeGreaterThan(0);
    // WebP magic: RIFF....WEBP
    expect(result.buffer.slice(0, 4).toString()).toBe('RIFF');
    expect(result.buffer.slice(8, 12).toString()).toBe('WEBP');
  });
});

describe('renderCard with timing', () => {
  it('returns phases when timing is true', async () => {
    const result = await renderCard({
      ...defaultOptions(),
      timing: true,
    });
    expect(result.phases).toBeDefined();
    expect(result.phases!.textMeasureMs).toBeGreaterThanOrEqual(0);
    expect(result.phases!.canvasDrawMs).toBeGreaterThanOrEqual(0);
    expect(result.phases!.pngEncodeMs).toBeGreaterThanOrEqual(0);
    expect(result.phases!.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('does not return phases when timing is false or omitted', async () => {
    const result = await renderCard(defaultOptions());
    expect(result.phases).toBeUndefined();
  });
});
