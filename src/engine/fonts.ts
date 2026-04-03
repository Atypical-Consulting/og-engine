import { GlobalFonts } from '@napi-rs/canvas';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export interface FontEntry {
  name: string;
  family: string;
  weights: number[];
  scripts: string[];
  slug?: string;
}

export const FONTS: FontEntry[] = [
  { name: 'Outfit', family: 'Outfit', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Inter', family: 'Inter', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Playfair Display', family: 'Playfair Display', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Sora', family: 'Sora', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Space Grotesk', family: 'Space Grotesk', weights: [400, 700], scripts: ['Latin'] },
  { name: 'JetBrains Mono', family: 'JetBrains Mono', weights: [400, 700], scripts: ['Latin'] },
  { name: 'Noto Sans JP', family: 'Noto Sans JP', weights: [400, 700], scripts: ['Latin', 'CJK'] },
  {
    name: 'Noto Sans AR',
    family: 'Noto Sans Arabic',
    weights: [400, 700],
    scripts: ['Latin', 'Arabic'],
    slug: 'noto-sans-arabic',
  },
];

const FONT_NAMES = FONTS.map((f) => f.name);

let registered = false;

export async function registerFonts(fontsDir: string): Promise<string[]> {
  if (registered) return FONT_NAMES;

  const loaded: string[] = [];

  for (const entry of FONTS) {
    const slug = entry.slug ?? entry.name.toLowerCase().replace(/\s+/g, '-');
    const dir = join(fontsDir, slug);

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
  return FONTS.some((f) => f.name === name);
}
