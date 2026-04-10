import { describe, expect, it } from 'vitest';
import { extractMeta } from '../../src/engine/meta-extract';

const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>My Blog Post</title>
  <meta property="og:title" content="OG Title Override" />
  <meta property="og:description" content="A great article about testing." />
  <meta property="og:image" content="https://example.com/og.jpg" />
  <meta name="author" content="Jane Doe" />
  <meta property="article:tag" content="Testing" />
  <meta property="og:site_name" content="My Blog" />
</head>
<body></body>
</html>`;

describe('extractMeta', () => {
  it('extracts OG tags into variables', () => {
    const result = extractMeta(sampleHtml);
    expect(result.variables.title).toBe('OG Title Override');
    expect(result.variables.description).toBe('A great article about testing.');
    expect(result.variables.author).toBe('Jane Doe');
    expect(result.variables.tag).toBe('Testing');
    expect(result.variables.siteName).toBe('My Blog');
  });

  it('extracts og:image into images map', () => {
    const result = extractMeta(sampleHtml);
    expect(result.images.background).toBe('https://example.com/og.jpg');
  });

  it('falls back to <title> when og:title is missing', () => {
    const html = '<html><head><title>Fallback Title</title></head></html>';
    const result = extractMeta(html);
    expect(result.variables.title).toBe('Fallback Title');
  });

  it('falls back to meta description when og:description is missing', () => {
    const html = '<html><head><meta name="description" content="Meta desc" /></head></html>';
    const result = extractMeta(html);
    expect(result.variables.description).toBe('Meta desc');
  });

  it('handles missing meta tags gracefully', () => {
    const html = '<html><head></head><body></body></html>';
    const result = extractMeta(html);
    expect(result.variables.title).toBe('');
    expect(result.variables.description).toBe('');
    expect(result.images).toEqual({});
  });

  it('extracts twitter:image when og:image is missing', () => {
    const html = '<html><head><meta name="twitter:image" content="https://example.com/tw.jpg" /></head></html>';
    const result = extractMeta(html);
    expect(result.images.background).toBe('https://example.com/tw.jpg');
  });
});
