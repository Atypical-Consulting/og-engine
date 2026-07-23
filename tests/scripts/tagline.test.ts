import { describe, expect, it } from 'vitest';
import { extractTagline } from '../../scripts/banners/tagline';

describe('extractTagline', () => {
  it('returns the first prose line, skipping headings/badges/blanks', () => {
    const md = [
      '# FormCraft',
      '',
      '![build](https://img.shields.io/badge/build-passing-green)',
      '[![nuget](https://img.shields.io/nuget/v/x)](https://nuget.org/x)',
      '',
      'Dynamic forms for **Blazor** — fluent + attribute-based.',
      '',
      '## Features',
    ].join('\n');
    expect(extractTagline(md)).toBe('Dynamic forms for Blazor — fluent + attribute-based.');
  });

  it('skips HTML comment blocks and centered <p> tags', () => {
    const md = ['<!-- a comment', 'still comment -->', '<p align="center">', 'The pitch line.'].join('\n');
    expect(extractTagline(md)).toBe('The pitch line.');
  });

  it('accepts a blockquote tagline', () => {
    expect(extractTagline('# X\n\n> The fastest way to do Y.')).toBe('The fastest way to do Y.');
  });

  it('returns null when there is no prose line', () => {
    expect(extractTagline('# OnlyHeading\n\n## AnotherHeading')).toBeNull();
    expect(extractTagline('')).toBeNull();
  });
});
