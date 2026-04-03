import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { autoFitCard, autoFitText } from '../../src/engine/autofit';
import { registerFonts } from '../../src/engine/fonts';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

describe('autoFitText', () => {
  it('returns maxSize when short text fits', () => {
    const result = autoFitText({
      text: 'Hi',
      format: 'og',
      fontName: 'Outfit',
      fontWeight: '800',
      maxLines: 3,
      minSize: 28,
      maxSize: 72,
    });
    expect(result.fontSize).toBe(72);
    expect(result.overflow).toBe(false);
  });

  it('reduces font size for long text', () => {
    const result = autoFitText({
      text: 'This is an extremely long title that will certainly need a smaller font size to fit within the allowed number of lines for the OG image format',
      format: 'og',
      fontName: 'Outfit',
      fontWeight: '800',
      maxLines: 3,
      minSize: 28,
      maxSize: 72,
    });
    expect(result.fontSize).toBeLessThan(72);
    expect(result.fontSize).toBeGreaterThanOrEqual(28);
    expect(result.overflow).toBe(false);
  });

  it('returns minSize with overflow when text is too long even at minimum', () => {
    const veryLong = 'word '.repeat(200);
    const result = autoFitText({
      text: veryLong,
      format: 'og',
      fontName: 'Outfit',
      fontWeight: '800',
      maxLines: 2,
      minSize: 60,
      maxSize: 72,
    });
    expect(result.fontSize).toBe(60);
    expect(result.overflow).toBe(true);
  });
});

describe('autoFitCard', () => {
  it('returns fitted sizes for title and description', () => {
    const result = autoFitCard({
      title: 'A reasonable title for an OG image',
      description: 'A short description.',
      format: 'og',
      fontName: 'Outfit',
    });
    expect(result.titleSize).toBeGreaterThanOrEqual(28);
    expect(result.titleSize).toBeLessThanOrEqual(72);
    expect(result.descSize).toBeGreaterThanOrEqual(14);
    expect(result.descSize).toBeLessThanOrEqual(32);
  });

  it('handles empty description', () => {
    const result = autoFitCard({
      title: 'Title only',
      description: '',
      format: 'og',
      fontName: 'Outfit',
    });
    expect(result.descSize).toBe(32); // max when no description
    expect(result.descLines).toBe(0);
  });
});
