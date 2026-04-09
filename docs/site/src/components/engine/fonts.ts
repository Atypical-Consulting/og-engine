/**
 * Playground client font registry.
 *
 * Imports the canonical CURATED_FONTS list from the API server's
 * font-catalog.ts and adds runtime helpers for loading Google Fonts CSS
 * into the browser at preview time. The two systems share the same set
 * of "API ready" fonts.
 */

import { CURATED_FONTS, type CuratedFontEntry } from '../../../../../src/engine/font-catalog';

export type FontEntry = CuratedFontEntry & {
  /** Pre-built Google Fonts CSS URL for this font */
  google: string;
  /** Legacy alias used by some existing playground code */
  scripts: string[];
};

function buildGoogleUrl(family: string, weights: number[]): string {
  const wghtList = weights.join(';');
  return `${family.replace(/ /g, '+')}:wght@${wghtList}`;
}

function curatedToFontEntry(f: CuratedFontEntry): FontEntry {
  return {
    ...f,
    google: buildGoogleUrl(f.family, f.weights),
    scripts: f.subsets.map((s) =>
      s === 'latin' ? 'Latin' : s === 'cjk' ? 'CJK' : s === 'arabic' ? 'Arabic' : s,
    ),
  };
}

export const FONTS: FontEntry[] = CURATED_FONTS.map(curatedToFontEntry);

const loadedFonts = new Set<string>();

/**
 * Load a font from the curated catalog (already-known weights).
 * Idempotent — calls beyond the first are no-ops.
 */
export function loadGoogleFont(entry: FontEntry): void {
  if (loadedFonts.has(entry.name)) return;
  loadedFonts.add(entry.name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${entry.google}&display=swap`;
  document.head.appendChild(link);
}

/**
 * Load any Google Font by family name + weight list (used by FontCombobox
 * to lazily load Preview-only fonts that aren't in CURATED_FONTS).
 */
export function loadGoogleFontByFamily(family: string, weights: number[] = [400, 700]): void {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const wghtList = weights.join(';');
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${wghtList}&display=swap`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

export function getFontByName(name: string): FontEntry {
  return FONTS.find((f) => f.name === name) ?? FONTS[0];
}
