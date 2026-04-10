import * as cheerio from 'cheerio';

export interface MetaResult {
  variables: Record<string, string>;
  images: Record<string, string>;
}

/**
 * Extract OG/meta tags from an HTML string and return them as
 * variables + images suitable for the render pipeline.
 */
export function extractMeta(html: string): MetaResult {
  const $ = cheerio.load(html);

  const og = (prop: string): string => $(`meta[property="${prop}"]`).attr('content') ?? '';

  const meta = (name: string): string => $(`meta[name="${name}"]`).attr('content') ?? '';

  const title = og('og:title') || meta('twitter:title') || $('title').text().trim();

  const description = og('og:description') || meta('twitter:description') || meta('description');

  const author = meta('author') || og('article:author') || meta('twitter:creator');

  const tag = og('article:tag') || og('article:section') || meta('keywords')?.split(',')[0]?.trim() || '';

  const siteName = og('og:site_name');

  const ogImage = og('og:image') || meta('twitter:image');

  const variables: Record<string, string> = {
    title,
    description,
    author,
    tag,
  };

  if (siteName) variables.siteName = siteName;

  const images: Record<string, string> = {};
  if (ogImage) images.background = ogImage;

  return { variables, images };
}
