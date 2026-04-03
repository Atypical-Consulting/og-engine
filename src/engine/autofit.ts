import { getFontByName } from './fonts';
import { FORMATS, type FormatKey } from './formats';
import { measureLines } from './text-measure';

export interface AutoFitOptions {
  text: string;
  format: FormatKey;
  fontName: string;
  fontWeight: string;
  maxLines: number;
  minSize: number;
  maxSize: number;
}

export interface AutoFitResult {
  fontSize: number;
  lines: number;
  overflow: boolean;
}

/**
 * Binary search for the largest font size where text fits within maxLines.
 * Returns the optimal size between minSize and maxSize.
 */
export function autoFitText(options: AutoFitOptions): AutoFitResult {
  const { text, format, fontName, fontWeight, maxLines, minSize, maxSize } = options;

  const fmt = FORMATS[format];
  if (!fmt) throw new Error(`Unknown format: ${format}`);

  const fontEntry = getFontByName(fontName);
  const ff = fontEntry.family;
  const s = Math.max(fmt.w, fmt.h) / 1200;
  const px = Math.round(64 * s);
  const contentWidth = fmt.w - px * 2;

  // Test if a given font size fits
  function fitsAt(size: number): { lines: number; fits: boolean } {
    const font = `${fontWeight} ${Math.round(size * s)}px ${ff}`;
    const lines = measureLines(text, font, contentWidth);
    return { lines: lines.length, fits: lines.length <= maxLines };
  }

  // Binary search: find largest size that fits
  let lo = minSize;
  let hi = maxSize;
  let bestSize = minSize;
  let bestLines = 0;

  // Quick check: if max size fits, use it
  const atMax = fitsAt(maxSize);
  if (atMax.fits) {
    return { fontSize: maxSize, lines: atMax.lines, overflow: false };
  }

  // Quick check: if min size doesn't fit, return min with overflow
  const atMin = fitsAt(minSize);
  if (!atMin.fits) {
    return { fontSize: minSize, lines: atMin.lines, overflow: true };
  }

  // Binary search
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const result = fitsAt(mid);

    if (result.fits) {
      bestSize = mid;
      bestLines = result.lines;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return { fontSize: bestSize, lines: bestLines, overflow: false };
}

/**
 * Auto-fit both title and description sizes for a render request.
 */
export function autoFitCard(options: {
  title: string;
  description: string;
  format: FormatKey;
  fontName: string;
  titleSizeRange?: [number, number];
  descSizeRange?: [number, number];
  maxTitleLines?: number;
  maxDescLines?: number;
}): { titleSize: number; descSize: number; titleLines: number; descLines: number } {
  const { title, description, format, fontName, titleSizeRange = [28, 72], descSizeRange = [14, 32] } = options;

  const fmt = FORMATS[format];
  if (!fmt) throw new Error(`Unknown format: ${format}`);

  const maxTitleLines = options.maxTitleLines ?? fmt.maxTitleLines;
  const maxDescLines = options.maxDescLines ?? fmt.maxDescLines;

  const titleFit = autoFitText({
    text: title,
    format,
    fontName,
    fontWeight: '800',
    maxLines: maxTitleLines,
    minSize: titleSizeRange[0],
    maxSize: titleSizeRange[1],
  });

  let descFit = { fontSize: descSizeRange[1], lines: 0, overflow: false };
  if (description) {
    descFit = autoFitText({
      text: description,
      format,
      fontName,
      fontWeight: '400',
      maxLines: maxDescLines,
      minSize: descSizeRange[0],
      maxSize: descSizeRange[1],
    });
  }

  return {
    titleSize: titleFit.fontSize,
    descSize: descFit.fontSize,
    titleLines: titleFit.lines,
    descLines: descFit.lines,
  };
}
