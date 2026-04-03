import { createCanvas } from '@napi-rs/canvas';
import { LRUCache } from './cache';

export interface MeasuredLine {
  text: string;
  width: number;
}

const measureCanvas = createCanvas(1, 1);
const measureCtx = measureCanvas.getContext('2d');

const lineCache = new LRUCache<string, MeasuredLine[]>(2000);

export function measureLines(text: string, font: string, maxWidth: number): MeasuredLine[] {
  if (!text || maxWidth <= 0) return [];

  const cacheKey = `${text}\0${font}\0${maxWidth}`;
  const cached = lineCache.get(cacheKey);
  if (cached) return cached;

  measureCtx.font = font;
  const lines: MeasuredLine[] = [];

  for (const para of text.split('\n')) {
    if (!para.trim()) {
      lines.push({ text: '', width: 0 });
      continue;
    }

    let cur = '';
    let curW = 0;

    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const ww = measureCtx.measureText(word).width;
      const sp = cur ? measureCtx.measureText(' ').width : 0;

      if (curW + sp + ww > maxWidth && cur) {
        lines.push({ text: cur, width: curW });
        cur = word;
        curW = ww;
      } else {
        cur += (cur ? ' ' : '') + word;
        curW += sp + ww;
      }
    }

    if (cur) lines.push({ text: cur, width: curW });
  }

  lineCache.set(cacheKey, lines);
  return lines;
}

export function clearMeasureCache(): void {
  lineCache.clear();
}

export function getMeasureCacheSize(): number {
  return lineCache.size;
}

export function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}
