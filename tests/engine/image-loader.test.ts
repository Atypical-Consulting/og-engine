import { describe, expect, it } from 'vitest';
import { loadRemoteImage, loadRemoteImages } from '../../src/engine/image-loader';

describe('loadRemoteImage', () => {
  it('loads a valid image from a URL', async () => {
    const img = await loadRemoteImage('https://www.google.com/favicon.ico');
    expect(img).toBeDefined();
    expect(img).not.toBeNull();
    expect(img!.width).toBeGreaterThan(0);
    expect(img!.height).toBeGreaterThan(0);
  });

  it('returns null for invalid URLs', async () => {
    const img = await loadRemoteImage('https://this-domain-does-not-exist-12345.com/img.png');
    expect(img).toBeNull();
  });

  it('returns null for non-image content types', async () => {
    const img = await loadRemoteImage('https://example.com');
    expect(img).toBeNull();
  });
});

describe('loadRemoteImages', () => {
  it('loads multiple images in parallel', async () => {
    const result = await loadRemoteImages({
      favicon: 'https://www.google.com/favicon.ico',
      bad: 'https://this-domain-does-not-exist-12345.com/nope.png',
    });
    expect(result.favicon).not.toBeNull();
    expect(result.bad).toBeNull();
  });

  it('returns empty map for empty input', async () => {
    const result = await loadRemoteImages({});
    expect(result).toEqual({});
  });
});
