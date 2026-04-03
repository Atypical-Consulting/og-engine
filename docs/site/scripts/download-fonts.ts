import { mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';

const FONTS_DIR = join(import.meta.dir, '..', 'public', 'fonts');

const FONT_SPECS = [
  { name: 'Syne', weights: [400, 600, 700, 800] },
  { name: 'Figtree', weights: [400, 500, 600, 700] },
  { name: 'Fira Code', weights: [400, 500, 700] },
] as const;

const WEIGHT_NAMES: Record<number, string> = {
  400: 'regular',
  500: 'medium',
  600: 'semibold',
  700: 'bold',
  800: 'extrabold',
};

async function downloadFont(family: string, weight: number): Promise<void> {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const dir = join(FONTS_DIR, slug);
  await mkdir(dir, { recursive: true });

  const weightName = WEIGHT_NAMES[weight] ?? String(weight);
  const filename = `${slug}-${weightName}.woff2`;
  const filepath = join(dir, filename);

  try {
    await stat(filepath);
    console.log(`  ✓ ${family} ${weightName} (cached)`);
    return;
  } catch {
    // File doesn't exist, download it
  }

  // Request woff2 format by using a modern User-Agent
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(cssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!cssRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: CSS fetch failed (${cssRes.status})`);
    return;
  }

  const css = await cssRes.text();
  const urlMatch = css.match(/url\(([^)]+\.woff2)\)/);
  if (!urlMatch) {
    console.error(`  ✗ ${family} ${weightName}: No woff2 URL found in CSS`);
    console.error(`    CSS snippet: ${css.slice(0, 300)}`);
    return;
  }

  const fontUrl = urlMatch[1];
  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) {
    console.error(`  ✗ ${family} ${weightName}: Download failed (${fontRes.status})`);
    return;
  }

  const buffer = await fontRes.arrayBuffer();
  await writeFile(filepath, Buffer.from(buffer));
  console.log(`  ↓ ${family} ${weightName} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
}

async function main() {
  console.log('Downloading docs site fonts to', FONTS_DIR);
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
