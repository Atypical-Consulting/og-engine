import { createHash } from 'node:crypto';
import { LRUCache } from './cache';

interface CachedImage {
  buffer: Buffer;
  contentType: string;
  headers: Record<string, string>;
}

const cache = new LRUCache<string, CachedImage>(Number(process.env.IMAGE_CACHE_MAX ?? 500));

export function hashRequest(body: unknown): string {
  const str = JSON.stringify(body);
  return createHash('sha256').update(str).digest('hex').slice(0, 32);
}

export function getCachedImage(hash: string): CachedImage | undefined {
  return cache.get(hash);
}

export function setCachedImage(hash: string, image: CachedImage): void {
  cache.set(hash, image);
}

export function getImageCacheSize(): number {
  return cache.size;
}

export function clearImageCache(): void {
  cache.clear();
}
