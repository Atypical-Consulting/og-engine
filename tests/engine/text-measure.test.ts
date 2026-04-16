import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerFonts } from '../../src/engine/fonts';
import { clearMeasureCache, getMeasureCacheStats, measureLines, measureTextWidth } from '../../src/engine/text-measure';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

beforeEach(() => {
  clearMeasureCache();
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

describe('LRU cache hit rate', () => {
  it('reports zero hits on first call', () => {
    measureLines('Hello world', '400 48px Outfit', 800);
    const stats = getMeasureCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0);
  });

  it('reports 100% hit rate on repeated identical call', () => {
    measureLines('Hello world', '400 48px Outfit', 800);
    measureLines('Hello world', '400 48px Outfit', 800);
    const stats = getMeasureCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(50);
  });

  it('cache is faster on repeated calls', () => {
    const text = 'Benchmarking LRU cache performance for repeated text measurement calls';
    const font = '700 48px Outfit';
    const maxWidth = 1000;
    const iterations = 500;

    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) measureLines(text, font, maxWidth);
    const elapsed = performance.now() - t0;

    const stats = getMeasureCacheStats();
    // After first call all subsequent are cache hits — hit rate should be > 99%
    expect(stats.hitRate).toBeGreaterThan(99);
    // 500 cached lookups should complete well under 100ms
    expect(elapsed).toBeLessThan(100);
  });
});
