/**
 * Canonical font catalog for OG Engine.
 *
 * This file is the single source of truth for which fonts the API server
 * has on disk and the playground exposes as "API ready". Both the server
 * (src/engine/fonts.ts) and the playground client
 * (docs/site/src/components/engine/fonts.ts) import CURATED_FONTS from
 * here. Add a font in one place, both sides pick it up after running
 * `bun run fonts:download`.
 */

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

export interface CuratedFontEntry {
  /** Display name shown in the picker */
  name: string;
  /** CSS font-family value (often equal to name; differs for Noto Sans Arabic) */
  family: string;
  /** Directory name under /fonts/ */
  slug: string;
  /** Weights physically available on disk */
  weights: number[];
  /** Coarse category for filter chips */
  category: FontCategory;
  /** Unicode subsets covered (latin, cjk, arabic, cyrillic, etc.) */
  subsets: string[];
}

export const CURATED_FONTS: CuratedFontEntry[] = [
  // ── Sans-serif (22) ──────────────────────────────────────────────
  {
    name: 'Inter',
    family: 'Inter',
    slug: 'inter',
    weights: [400, 700, 800],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  { name: 'Roboto', family: 'Roboto', slug: 'roboto', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  {
    name: 'Open Sans',
    family: 'Open Sans',
    slug: 'open-sans',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  { name: 'Lato', family: 'Lato', slug: 'lato', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  {
    name: 'Montserrat',
    family: 'Montserrat',
    slug: 'montserrat',
    weights: [400, 700, 800],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Poppins',
    family: 'Poppins',
    slug: 'poppins',
    weights: [400, 700, 800],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Outfit',
    family: 'Outfit',
    slug: 'outfit',
    weights: [400, 700, 800],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  { name: 'Sora', family: 'Sora', slug: 'sora', weights: [400, 700, 800], category: 'sans-serif', subsets: ['latin'] },
  {
    name: 'Space Grotesk',
    family: 'Space Grotesk',
    slug: 'space-grotesk',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'DM Sans',
    family: 'DM Sans',
    slug: 'dm-sans',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Manrope',
    family: 'Manrope',
    slug: 'manrope',
    weights: [400, 700, 800],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Plus Jakarta Sans',
    family: 'Plus Jakarta Sans',
    slug: 'plus-jakarta-sans',
    weights: [400, 700, 800],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Figtree',
    family: 'Figtree',
    slug: 'figtree',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Work Sans',
    family: 'Work Sans',
    slug: 'work-sans',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Nunito',
    family: 'Nunito',
    slug: 'nunito',
    weights: [400, 700, 800],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Nunito Sans',
    family: 'Nunito Sans',
    slug: 'nunito-sans',
    weights: [400, 700, 800],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  {
    name: 'Source Sans 3',
    family: 'Source Sans 3',
    slug: 'source-sans-3',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
  },
  { name: 'Karla', family: 'Karla', slug: 'karla', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Rubik', family: 'Rubik', slug: 'rubik', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Mulish', family: 'Mulish', slug: 'mulish', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  { name: 'Onest', family: 'Onest', slug: 'onest', weights: [400, 700], category: 'sans-serif', subsets: ['latin'] },
  {
    name: 'Albert Sans',
    family: 'Albert Sans',
    slug: 'albert-sans',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
  },

  // ── Serif (10) ───────────────────────────────────────────────────
  {
    name: 'Playfair Display',
    family: 'Playfair Display',
    slug: 'playfair-display',
    weights: [400, 700, 800],
    category: 'serif',
    subsets: ['latin'],
  },
  {
    name: 'Merriweather',
    family: 'Merriweather',
    slug: 'merriweather',
    weights: [400, 700],
    category: 'serif',
    subsets: ['latin'],
  },
  { name: 'Lora', family: 'Lora', slug: 'lora', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  {
    name: 'Crimson Pro',
    family: 'Crimson Pro',
    slug: 'crimson-pro',
    weights: [400, 700],
    category: 'serif',
    subsets: ['latin'],
  },
  {
    name: 'EB Garamond',
    family: 'EB Garamond',
    slug: 'eb-garamond',
    weights: [400, 700],
    category: 'serif',
    subsets: ['latin'],
  },
  {
    name: 'Cormorant Garamond',
    family: 'Cormorant Garamond',
    slug: 'cormorant-garamond',
    weights: [400, 700],
    category: 'serif',
    subsets: ['latin'],
  },
  {
    name: 'Source Serif 4',
    family: 'Source Serif 4',
    slug: 'source-serif-4',
    weights: [400, 700],
    category: 'serif',
    subsets: ['latin'],
  },
  {
    name: 'PT Serif',
    family: 'PT Serif',
    slug: 'pt-serif',
    weights: [400, 700],
    category: 'serif',
    subsets: ['latin'],
  },
  { name: 'Bitter', family: 'Bitter', slug: 'bitter', weights: [400, 700], category: 'serif', subsets: ['latin'] },
  {
    name: 'Spectral',
    family: 'Spectral',
    slug: 'spectral',
    weights: [400, 700],
    category: 'serif',
    subsets: ['latin'],
  },

  // ── Display (9) ──────────────────────────────────────────────────
  {
    name: 'Bebas Neue',
    family: 'Bebas Neue',
    slug: 'bebas-neue',
    weights: [400],
    category: 'display',
    subsets: ['latin'],
  },
  { name: 'Anton', family: 'Anton', slug: 'anton', weights: [400], category: 'display', subsets: ['latin'] },
  { name: 'Oswald', family: 'Oswald', slug: 'oswald', weights: [400, 700], category: 'display', subsets: ['latin'] },
  {
    name: 'Archivo Black',
    family: 'Archivo Black',
    slug: 'archivo-black',
    weights: [400],
    category: 'display',
    subsets: ['latin'],
  },
  {
    name: 'Fraunces',
    family: 'Fraunces',
    slug: 'fraunces',
    weights: [400, 700],
    category: 'display',
    subsets: ['latin'],
  },
  { name: 'Syne', family: 'Syne', slug: 'syne', weights: [400, 700, 800], category: 'display', subsets: ['latin'] },
  {
    name: 'Unbounded',
    family: 'Unbounded',
    slug: 'unbounded',
    weights: [400, 700],
    category: 'display',
    subsets: ['latin'],
  },
  {
    name: 'Bricolage Grotesque',
    family: 'Bricolage Grotesque',
    slug: 'bricolage-grotesque',
    weights: [400, 700, 800],
    category: 'display',
    subsets: ['latin'],
  },
  {
    name: 'Familjen Grotesk',
    family: 'Familjen Grotesk',
    slug: 'familjen-grotesk',
    weights: [400, 700],
    category: 'display',
    subsets: ['latin'],
  },

  // ── Monospace (5) ────────────────────────────────────────────────
  {
    name: 'JetBrains Mono',
    family: 'JetBrains Mono',
    slug: 'jetbrains-mono',
    weights: [400, 700],
    category: 'monospace',
    subsets: ['latin'],
  },
  {
    name: 'Fira Code',
    family: 'Fira Code',
    slug: 'fira-code',
    weights: [400, 700],
    category: 'monospace',
    subsets: ['latin'],
  },
  {
    name: 'IBM Plex Mono',
    family: 'IBM Plex Mono',
    slug: 'ibm-plex-mono',
    weights: [400, 700],
    category: 'monospace',
    subsets: ['latin'],
  },
  {
    name: 'Geist Mono',
    family: 'Geist Mono',
    slug: 'geist-mono',
    weights: [400, 700],
    category: 'monospace',
    subsets: ['latin'],
  },
  {
    name: 'Space Mono',
    family: 'Space Mono',
    slug: 'space-mono',
    weights: [400, 700],
    category: 'monospace',
    subsets: ['latin'],
  },

  // ── Handwriting (3) ──────────────────────────────────────────────
  {
    name: 'Caveat',
    family: 'Caveat',
    slug: 'caveat',
    weights: [400, 700],
    category: 'handwriting',
    subsets: ['latin'],
  },
  { name: 'Kalam', family: 'Kalam', slug: 'kalam', weights: [400, 700], category: 'handwriting', subsets: ['latin'] },
  {
    name: 'Pacifico',
    family: 'Pacifico',
    slug: 'pacifico',
    weights: [400],
    category: 'handwriting',
    subsets: ['latin'],
  },

  // ── CJK + Arabic (4) ─────────────────────────────────────────────
  {
    name: 'Noto Sans JP',
    family: 'Noto Sans JP',
    slug: 'noto-sans-jp',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin', 'cjk'],
  },
  {
    name: 'Noto Sans Arabic',
    family: 'Noto Sans Arabic',
    slug: 'noto-sans-arabic',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin', 'arabic'],
  },
  {
    name: 'Noto Sans SC',
    family: 'Noto Sans SC',
    slug: 'noto-sans-sc',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin', 'cjk'],
  },
  {
    name: 'Noto Sans KR',
    family: 'Noto Sans KR',
    slug: 'noto-sans-kr',
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin', 'cjk'],
  },
];

const CURATED_NAMES = new Set(CURATED_FONTS.map((f) => f.name));

export function isCuratedFont(name: string): boolean {
  return CURATED_NAMES.has(name);
}

/**
 * A tighter, tasteful subset surfaced in the playground font picker.
 * The full CURATED_FONTS list remains accepted by the API; this is
 * purely a UI narrowing so first-time users don't drown in choice.
 *
 * Rules for inclusion:
 * - Distinctive voice (skip "also a sans" clones)
 * - Good at display sizes
 * - At least one bold weight available
 * - Covers the typographic range: modern/neo-grotesk, friendly, geometric,
 *   editorial serif, display, mono, script — one of each, no filler.
 */
const FEATURED_NAMES = new Set<string>([
  // Modern / neo-grotesk sans — the workhorses
  'Inter',
  'Space Grotesk',
  'DM Sans',
  'Plus Jakarta Sans',
  'Manrope',
  'Onest',
  // Friendly / humanist sans
  'Outfit',
  'Sora',
  'Figtree',
  // Editorial serif
  'Playfair Display',
  'Fraunces',
  'Cormorant Garamond',
  'EB Garamond',
  'Source Serif 4',
  // Display / headline
  'Bebas Neue',
  'Anton',
  'Archivo Black',
  'Bricolage Grotesque',
  'Syne',
  'Unbounded',
  // Monospace (for tech/dev feel)
  'JetBrains Mono',
  'IBM Plex Mono',
  'Geist Mono',
  // Handwriting / script (for personality)
  'Caveat',
  'Pacifico',
]);

export const FEATURED_FONTS: CuratedFontEntry[] = CURATED_FONTS.filter((f) => FEATURED_NAMES.has(f.name));

export function isFeaturedFont(name: string): boolean {
  return FEATURED_NAMES.has(name);
}
