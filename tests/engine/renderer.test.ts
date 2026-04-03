import { describe, it, expect, beforeAll } from 'vitest';
import { renderCard, type RenderOptions } from '../../src/engine/renderer';
import { registerFonts } from '../../src/engine/fonts';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

function defaultOptions(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return {
    title: 'Hello, OG Engine',
    description: 'Generated in 2ms, no browser needed.',
    author: 'Test Author',
    tag: 'Test',
    format: 'og',
    accent: '#38ef7d',
    layout: 'left',
    titleSize: 48,
    descSize: 22,
    fontName: 'Outfit',
    gradient: 'void',
    bgImageBuffer: null,
    overlayOpacity: 0.65,
    ...overrides,
  };
}

describe('renderCard', () => {
  it('returns a PNG buffer for default OG format', () => {
    const result = renderCard(defaultOptions());
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    // PNG magic bytes: 0x89 P N G
    expect(result.buffer[0]).toBe(0x89);
    expect(result.buffer[1]).toBe(0x50);
    expect(result.buffer[2]).toBe(0x4e);
    expect(result.buffer[3]).toBe(0x47);
  });

  it('returns render metadata', () => {
    const result = renderCard(defaultOptions());
    expect(result.titleTotalLines).toBeGreaterThan(0);
    expect(result.titleVisibleLines).toBeGreaterThan(0);
    expect(typeof result.overflow).toBe('boolean');
  });

  it('produces correct dimensions (1200x630 for OG)', () => {
    const result = renderCard(defaultOptions());
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
  });

  it('renders all 5 formats without error', () => {
    for (const format of ['og', 'twitter', 'square', 'linkedin', 'story'] as const) {
      const result = renderCard(defaultOptions({ format }));
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  });

  it('renders all 3 layouts without error', () => {
    for (const layout of ['left', 'center', 'bottom'] as const) {
      const result = renderCard(defaultOptions({ layout }));
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  });

  it('detects overflow for very long title', () => {
    const result = renderCard(defaultOptions({
      title: 'This is an extremely long title that will certainly overflow the maximum number of lines allowed for the OG format which only permits three lines of title text',
    }));
    expect(result.overflow).toBe(true);
    expect(result.titleTotalLines).toBeGreaterThan(result.titleVisibleLines);
  });

  it('handles missing optional fields', () => {
    const result = renderCard(defaultOptions({
      description: '',
      author: '',
      tag: '',
    }));
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
