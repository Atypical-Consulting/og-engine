import { mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';

const FONTS_DIR = join(import.meta.dir, '..', 'fonts');

const FONT_SPECS = [
  { name: 'Outfit', weights: [400, 700, 800] },
  { name: 'Inter', weights: [400, 700, 800] },
  { name: 'Playfair Display', weights: [400, 700, 800] },
  { name: 'Sora', weights: [400, 700, 800] },
  { name: 'Space Grotesk', weights: [400, 700] },
  { name: 'JetBrains Mono', weights: [400, 700] },
  { name: 'Noto Sans JP', weights: [400, 700] },
  { name: 'Noto Sans Arabic', weights: [400, 700] },
] as const;

const WEIGHT_NAMES: Record<number, string> = {
  400: 'Regular',
  700: 'Bold',
  800: 'ExtraBold',
};

async function downloadFont(family: string, weight: number): Promise<void> {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const dir = join(FONTS_DIR, slug);
  await mkdir(dir, { recursive: true });

  const weightName = WEIGHT_NAMES[weight] ?? String(weight);
  const filename = `${slug}-${weightName.toLowerCase()}.ttf`;
  const filepath = join(dir, filename);

  try {
    await stat(filepath);
    console.log(`  ✓ ${family} ${weightName} (cached)`);
    return;
  } catch {
    // File doesn't exist, download it
  }

  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(cssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/534.54.16 (KHTML, like Gecko) Version/5.1.4 Safari/534.54.16',
    },
  });

  if (!cssRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: CSS fetch failed (${cssRes.status})`);
    return;
  }

  const css = await cssRes.text();
  const urlMatch = css.match(/url\(([^)]+\.ttf)\)/);
  if (!urlMatch) {
    console.error(`  ✗ ${family} ${weightName}: No TTF URL found in CSS`);
    console.error(`    CSS snippet: ${css.slice(0, 200)}`);
    return;
  }

  const ttfUrl = urlMatch[1];
  const ttfRes = await fetch(ttfUrl);
  if (!ttfRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: TTF download failed (${ttfRes.status})`);
    return;
  }

  const buffer = await ttfRes.arrayBuffer();
  await writeFile(filepath, Buffer.from(buffer));
  console.log(`  ↓ ${family} ${weightName} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
}

async function main() {
  console.log('Downloading fonts to', FONTS_DIR);
  console.log('');

  for (const spec of FONT_SPECS) {
    console.log(spec.name);
    for (const weight of spec.weights) {
      await downloadFont(spec.name, weight);
    }
    console.log('');
  }

  console.log('Done.');
}

main().catch(console.error);
