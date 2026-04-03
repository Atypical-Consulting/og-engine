import { describe, it, expect } from 'vitest';
import { FORMATS, FORMAT_KEYS } from '../../src/engine/formats';

describe('FORMATS', () => {
  it('defines exactly 5 formats', () => {
    expect(FORMAT_KEYS).toHaveLength(5);
  });

  it('includes og, twitter, square, linkedin, story', () => {
    expect(FORMAT_KEYS).toContain('og');
    expect(FORMAT_KEYS).toContain('twitter');
    expect(FORMAT_KEYS).toContain('square');
    expect(FORMAT_KEYS).toContain('linkedin');
    expect(FORMAT_KEYS).toContain('story');
  });

  it('og format is 1200x630 with 3 title / 4 desc max lines', () => {
    const og = FORMATS['og'];
    expect(og.w).toBe(1200);
    expect(og.h).toBe(630);
    expect(og.maxTitleLines).toBe(3);
    expect(og.maxDescLines).toBe(4);
  });

  it('story format is 1080x1920 with 5 title / 6 desc max lines', () => {
    const story = FORMATS['story'];
    expect(story.w).toBe(1080);
    expect(story.h).toBe(1920);
    expect(story.maxTitleLines).toBe(5);
    expect(story.maxDescLines).toBe(6);
  });
});
