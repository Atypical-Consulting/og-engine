export interface FontEntry {
  name: string;
  family: string;
  google: string | null;
  weights: number[];
  scripts: string[];
}

export const FONTS: FontEntry[] = [
  { name: 'Outfit', family: "'Outfit', sans-serif", google: 'Outfit:wght@400;700;800', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Inter', family: "'Inter', sans-serif", google: 'Inter:wght@400;700;800', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Playfair Display', family: "'Playfair Display', serif", google: 'Playfair+Display:wght@400;700;800', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Sora', family: "'Sora', sans-serif", google: 'Sora:wght@400;700;800', weights: [400, 700, 800], scripts: ['Latin'] },
  { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif", google: 'Space+Grotesk:wght@400;700', weights: [400, 700], scripts: ['Latin'] },
  { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace", google: 'JetBrains+Mono:wght@400;700', weights: [400, 700], scripts: ['Latin'] },
  { name: 'Noto Sans JP', family: "'Noto Sans JP', sans-serif", google: 'Noto+Sans+JP:wght@400;700', weights: [400, 700], scripts: ['Latin', 'CJK'] },
  { name: 'Noto Sans AR', family: "'Noto Sans Arabic', sans-serif", google: 'Noto+Sans+Arabic:wght@400;700', weights: [400, 700], scripts: ['Latin', 'Arabic'] },
];

const loadedFonts = new Set<string>();

export function loadGoogleFont(entry: FontEntry): void {
  if (!entry.google || loadedFonts.has(entry.name)) return;
  loadedFonts.add(entry.name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${entry.google}&display=swap`;
  document.head.appendChild(link);
}

export function getFontByName(name: string): FontEntry {
  return FONTS.find((f) => f.name === name) ?? FONTS[0];
}
