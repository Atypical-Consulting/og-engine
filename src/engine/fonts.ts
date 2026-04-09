import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { CURATED_FONTS, type CuratedFontEntry, isCuratedFont } from './font-catalog';

/**
 * Legacy alias for backward compatibility. Use CURATED_FONTS directly in new code.
 *
 * The shape changed slightly (added `slug`, `category`, `subsets`; removed `scripts`)
 * but the legacy `scripts` field is derived from `subsets` for any caller that
 * still needs it.
 */
export type FontEntry = CuratedFontEntry & { scripts: string[] };

/** All fonts the API server is configured to support. */
export const FONTS: FontEntry[] = CURATED_FONTS.map((f) => ({
  ...f,
  scripts: f.subsets.map((s) => (s === 'latin' ? 'Latin' : s === 'cjk' ? 'CJK' : s === 'arabic' ? 'Arabic' : s)),
}));

const FONT_NAMES = FONTS.map((f) => f.name);

let registered = false;

export async function registerFonts(fontsDir: string): Promise<string[]> {
  if (registered) return FONT_NAMES;

  const loaded: string[] = [];

  for (const entry of FONTS) {
    const dir = join(fontsDir, entry.slug);

    try {
      await stat(dir);
    } catch {
      console.warn(`Font directory missing: ${dir} — skipping ${entry.name}`);
      continue;
    }

    const files = await readdir(dir);
    const ttfFiles = files.filter((f) => f.endsWith('.ttf'));

    for (const file of ttfFiles) {
      const filepath = join(dir, file);
      GlobalFonts.registerFromPath(filepath, entry.family);
    }

    if (ttfFiles.length > 0) {
      loaded.push(entry.name);
    }
  }

  registered = true;
  console.log(`Registered ${loaded.length} font families: ${loaded.join(', ')}`);
  return loaded;
}

export function getFontByName(name: string): FontEntry {
  return FONTS.find((f) => f.name === name) ?? FONTS[0];
}

export function isValidFont(name: string): boolean {
  return isCuratedFont(name);
}
