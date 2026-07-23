import { describe, expect, it } from 'vitest';
import { extractTagline } from '../../scripts/banners/tagline';

describe('extractTagline', () => {
  // Original tests
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

  // Rule 1: Never return empty string
  it('never returns empty string (skips spaced horizontal rule)', () => {
    expect(extractTagline('# T\n\n* * *\n\nReal prose.')).toBe('Real prose.');
  });

  it('skips lone blockquote markers', () => {
    expect(extractTagline('# T\n\n>\n> The real tagline.')).toBe('The real tagline.');
  });

  // Rule 2: Strip HTML tags from returned text
  it('strips HTML tags from inline prose', () => {
    expect(extractTagline('# T\n\n<p align="center">The pitch line.</p>')).toBe('The pitch line.');
  });

  it('strips nested HTML tags from prose', () => {
    expect(extractTagline('# T\n\n<div><span>Nested markup</span></div>')).toBe('Nested markup');
  });

  // Rule 3: Heading detection requires CommonMark space
  it('requires CommonMark space after # for heading detection', () => {
    expect(extractTagline('# T\n\n#1 rated tool.')).toBe('#1 rated tool.');
  });

  // Rule 4: Same-line closed HTML comment with trailing prose
  it('handles same-line HTML comment with trailing prose', () => {
    expect(extractTagline('<!-- TODO --> The fastest way to ship.')).toBe('The fastest way to ship.');
  });

  it('extracts prose after multiline comment close', () => {
    expect(extractTagline('# T\n<!-- comment\nstill comment --> Real prose.')).toBe('Real prose.');
  });

  // Rule 5: Badge/image with trailing prose
  it('strips leading badge/image and keeps trailing prose', () => {
    expect(extractTagline('![build](https://img.shields.io/badge/x) The fastest forms library.')).toBe(
      'The fastest forms library.',
    );
  });

  it('skips badge/image-only lines (strips to empty)', () => {
    expect(extractTagline('# T\n\n![a](x) [![b](y)](z)')).toBeNull();
  });

  // Rule 6: Additional coverage gaps
  it('skips bare link lines', () => {
    expect(extractTagline('# T\n\n[docs](url)\n\nReal prose.')).toBe('Real prose.');
  });

  it('skips horizontal rules', () => {
    expect(extractTagline('# T\n\n---\n\nReal prose.')).toBe('Real prose.');
  });

  it('strips inline links to text', () => {
    expect(extractTagline('# T\n\n[Read the docs](url) for more.')).toBe('Read the docs for more.');
  });

  it('strips inline images from prose', () => {
    expect(extractTagline('# T\n\nCheck ![icon](url) this out.')).toBe('Check this out.');
  });

  it('handles multiple inline images', () => {
    expect(extractTagline('![a](x) ![b](y) Real text')).toBe('Real text');
  });

  it('skips underscore-spaced line (becomes empty after stripping)', () => {
    expect(extractTagline('# T\n\n_ _\n\nReal prose.')).toBe('Real prose.');
  });

  // Regression tests: preserve angle brackets in prose (not HTML tags)
  it('preserves generic type syntax Array<string>', () => {
    expect(extractTagline('Supports Array<string> parameters.')).toBe('Supports Array<string> parameters.');
  });

  it('preserves generic type syntax Promise<T>', () => {
    expect(extractTagline('Use Promise<T> for async.')).toBe('Use Promise<T> for async.');
  });

  it('preserves generic type syntax List<T>', () => {
    expect(extractTagline('Iterate over List<T> with ease.')).toBe('Iterate over List<T> with ease.');
  });

  it('preserves angle bracket placeholders (underscore removed for markdown)', () => {
    // Note: underscores are stripped as Markdown emphasis markers, so <API_KEY> → <APIKEY>
    expect(extractTagline('Set your <API_KEY> variable.')).toBe('Set your <APIKEY> variable.');
  });

  it('preserves mathematical/logical expressions', () => {
    expect(extractTagline('Runs fast: 5 < 10 and 20 > 3.')).toBe('Runs fast: 5 < 10 and 20 > 3.');
  });

  it('still strips actual HTML tags from wrapped content', () => {
    expect(extractTagline('# T\n\n<p align="center">The pitch line.</p>')).toBe('The pitch line.');
  });

  it('preserves arrow in prose followed by --> in comment', () => {
    expect(extractTagline('<!-- end --> Note: A --> B mapping.')).toBe('Note: A --> B mapping.');
  });
});
