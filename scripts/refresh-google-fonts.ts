/**
 * Refresh the static Google Fonts catalog dump.
 *
 * Fetches the full font list from gwfh.mranftl.com (the public Google
 * Webfonts Helper mirror — no API key needed) and writes a trimmed JSON
 * file to:
 *
 *   src/data/google-fonts.json           (canonical copy)
 *   docs/site/public/google-fonts.json   (Astro static asset for the playground)
 *
 * Run manually: `bun run fonts:refresh-catalog`
 * Refresh frequency: quarterly is fine; the catalog changes slowly.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const SOURCE_URL = 'https://gwfh.mranftl.com/api/fonts';
const REPO_ROOT = join(import.meta.dir, '..');
const CANONICAL_OUT = join(REPO_ROOT, 'src', 'data', 'google-fonts.json');
const PUBLIC_OUT = join(REPO_ROOT, 'docs', 'site', 'public', 'google-fonts.json');

interface RawFont {
  id: string;
  family: string;
  category: string;
  subsets: string[];
  variants: string[];
  popularity: number;
}

interface TrimmedFont {
  family: string;
  category: string;
  subsets: string[];
  variants: string[];
  popularity: number;
}

async function main() {
  console.log(`Fetching Google Fonts catalog from ${SOURCE_URL}...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const raw = (await res.json()) as RawFont[];
  console.log(`Received ${raw.length} fonts.`);

  // Trim to the fields we actually use, sort by popularity (lower number = more popular)
  const trimmed: TrimmedFont[] = raw
    .map((f) => ({
      family: f.family,
      category: f.category,
      subsets: f.subsets,
      variants: f.variants,
      popularity: f.popularity,
    }))
    .sort((a, b) => a.popularity - b.popularity);

  const json = JSON.stringify(trimmed, null, 0);

  for (const out of [CANONICAL_OUT, PUBLIC_OUT]) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, json);
    console.log(`  ✓ wrote ${out} (${(json.length / 1024).toFixed(0)} KB)`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
