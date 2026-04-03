import { describe, expect, it } from 'vitest';
import {
  clearImageCache,
  getCachedImage,
  getImageCacheSize,
  hashRequest,
  setCachedImage,
} from '../../src/engine/image-cache';

describe('image cache', () => {
  it('caches and retrieves images', () => {
    clearImageCache();
    const hash = hashRequest({ format: 'og', title: 'Test' });
    const image = {
      buffer: Buffer.from('fake-png'),
      contentType: 'image/png',
      headers: { 'Content-Type': 'image/png' },
    };

    setCachedImage(hash, image);
    const cached = getCachedImage(hash);
    expect(cached).toBeDefined();
    expect(cached!.buffer.toString()).toBe('fake-png');
  });

  it('returns undefined for cache miss', () => {
    clearImageCache();
    expect(getCachedImage('nonexistent')).toBeUndefined();
  });

  it('produces consistent hashes', () => {
    const a = hashRequest({ format: 'og', title: 'Hello' });
    const b = hashRequest({ format: 'og', title: 'Hello' });
    expect(a).toBe(b);
  });

  it('produces different hashes for different requests', () => {
    const a = hashRequest({ format: 'og', title: 'Hello' });
    const b = hashRequest({ format: 'og', title: 'World' });
    expect(a).not.toBe(b);
  });

  it('tracks cache size', () => {
    clearImageCache();
    expect(getImageCacheSize()).toBe(0);
    setCachedImage('a', { buffer: Buffer.from('1'), contentType: 'image/png', headers: {} });
    setCachedImage('b', { buffer: Buffer.from('2'), contentType: 'image/png', headers: {} });
    expect(getImageCacheSize()).toBe(2);
  });
});
