import { describe, it, expect, beforeAll } from 'vitest';
import { measureLines, measureTextWidth } from '../../src/engine/text-measure';
import { registerFonts } from '../../src/engine/fonts';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

describe('measureLines', () => {
  it('returns empty array for empty text', () => {
    expect(measureLines('', '400 48px Outfit', 800)).toEqual([]);
  });

  it('returns single line for short text', () => {
    const lines = measureLines('Hello', '400 48px Outfit', 800);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello');
    expect(lines[0].width).toBeGreaterThan(0);
  });

  it('wraps long text into multiple lines', () => {
    const longText = 'This is a much longer title that should definitely wrap onto multiple lines when rendered';
    const lines = measureLines(longText, '800 48px Outfit', 600);
    expect(lines.length).toBeGreaterThan(1);
    const reconstructed = lines.map((l) => l.text).join(' ');
    expect(reconstructed).toBe(longText);
  });

  it('handles explicit newlines', () => {
    const lines = measureLines('Line one\nLine two', '400 48px Outfit', 800);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0].text).toBe('Line one');
    expect(lines[1].text).toBe('Line two');
  });
});

describe('measureTextWidth', () => {
  it('returns a positive number for non-empty text', () => {
    const w = measureTextWidth('Hello', '400 48px Outfit');
    expect(w).toBeGreaterThan(0);
  });

  it('returns 0 for empty text', () => {
    const w = measureTextWidth('', '400 48px Outfit');
    expect(w).toBe(0);
  });
});
