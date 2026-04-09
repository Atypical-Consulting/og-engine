/**
 * Download all CURATED_FONTS as TTF files into the repo-root fonts/ dir.
 *
 * The API server (src/engine/fonts.ts) registers .ttf files with
 * @napi-rs/canvas. WOFF2 is not supported by the canvas backend.
 *
 * Trick: Google Fonts CSS API returns TTF URLs when the request comes
 * from an old User-Agent that doesn't advertise WOFF2 support. We send
 * a Safari 5 UA to trigger this.
 *
 * Run via: `bun run fonts:download` from the repo root.
 * Idempotent — files that already exist are skipped.
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { CURATED_FONTS } from '../src/engine/font-catalog';

const FONTS_DIR = join(import.meta.dir, '..', 'fonts');

const LEGACY_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/534.54.16 (KHTML, like Gecko) Version/5.1.4 Safari/534.54.16';

const WEIGHT_NAMES: Record<number, string> = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

type Result = 'downloaded' | 'cached' | 'failed';

async function downloadFont(family: string, slug: string, weight: number): Promise<Result> {
  const dir = join(FONTS_DIR, slug);
  await mkdir(dir, { recursive: true });

  const weightName = WEIGHT_NAMES[weight] ?? String(weight);
  const filename = `${slug}-${weightName.toLowerCase()}.ttf`;
  const filepath = join(dir, filename);

  try {
    await stat(filepath);
    return 'cached';
  } catch {
    // doesn't exist
  }

  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': LEGACY_UA } });

  if (!cssRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: CSS fetch failed (${cssRes.status})`);
    return 'failed';
  }

  const css = await cssRes.text();
  const urlMatch = css.match(/url\(([^)]+\.ttf)\)/);
  if (!urlMatch) {
    console.error(`  ✗ ${family} ${weightName}: No TTF URL found in CSS`);
    return 'failed';
  }

  const fontRes = await fetch(urlMatch[1]);
  if (!fontRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: Download failed (${fontRes.status})`);
    return 'failed';
  }

  const buffer = await fontRes.arrayBuffer();
  await writeFile(filepath, Buffer.from(buffer));
  console.log(`  ↓ ${family} ${weightName} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
  return 'downloaded';
}

async function main() {
  console.log(`Downloading ${CURATED_FONTS.length} curated fonts into ${FONTS_DIR}\n`);

  let downloaded = 0;
  let cached = 0;
  let failed = 0;

  for (const entry of CURATED_FONTS) {
    console.log(entry.name);
    for (const weight of entry.weights) {
      const result = await downloadFont(entry.family, entry.slug, weight);
      if (result === 'downloaded') downloaded++;
      else if (result === 'cached') cached++;
      else failed++;
    }
    console.log('');
  }

  console.log(`Done. ${downloaded} downloaded, ${cached} already present, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
