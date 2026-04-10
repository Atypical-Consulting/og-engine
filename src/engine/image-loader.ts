import { type Image, loadImage } from '@napi-rs/canvas';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

/**
 * Fetch a single remote image. Returns null on any failure (timeout,
 * bad content type, decode error, etc.) — never throws.
 */
export async function loadRemoteImage(url: string): Promise<Image | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OGEngine/1.0' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(ct)) return null;

    const contentLength = Number(res.headers.get('content-length') ?? '0');
    if (contentLength > MAX_IMAGE_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;

    return await loadImage(buf);
  } catch {
    return null;
  }
}

/**
 * Fetch multiple named images in parallel.
 * Returns a map with the same keys — values are Image | null.
 */
export async function loadRemoteImages(urls: Record<string, string>): Promise<Record<string, Image | null>> {
  const entries = Object.entries(urls);
  if (entries.length === 0) return {};

  const results = await Promise.all(
    entries.map(async ([name, url]) => {
      const img = await loadRemoteImage(url);
      return [name, img] as const;
    }),
  );

  return Object.fromEntries(results);
}
