import { describe, expect, it } from 'vitest';
import { FORMAT_KEYS, FORMATS } from '../../src/engine/formats';

describe('FORMATS', () => {
  it('defines exactly 6 formats', () => {
    expect(FORMAT_KEYS).toHaveLength(6);
  });

  it('includes og, twitter, square, linkedin, story, readme', () => {
    expect(FORMAT_KEYS).toContain('og');
    expect(FORMAT_KEYS).toContain('twitter');
    expect(FORMAT_KEYS).toContain('square');
    expect(FORMAT_KEYS).toContain('linkedin');
    expect(FORMAT_KEYS).toContain('story');
    expect(FORMAT_KEYS).toContain('readme');
  });

  it('og format is 1200x630 with 3 title / 4 desc max lines', () => {
    const og = FORMATS.og;
    expect(og.w).toBe(1200);
    expect(og.h).toBe(630);
    expect(og.maxTitleLines).toBe(3);
    expect(og.maxDescLines).toBe(4);
  });

  it('story format is 1080x1920 with 5 title / 6 desc max lines', () => {
    const story = FORMATS.story;
    expect(story.w).toBe(1080);
    expect(story.h).toBe(1920);
    expect(story.maxTitleLines).toBe(5);
    expect(story.maxDescLines).toBe(6);
  });
});

describe('readme format', () => {
  it('exposes a 1280x640 banner format', () => {
    expect(FORMATS.readme).toMatchObject({ w: 1280, h: 640, maxTitleLines: 2, maxDescLines: 3 });
  });
});
