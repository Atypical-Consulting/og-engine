import { createCanvas } from '@napi-rs/canvas';

export interface MeasuredLine {
  text: string;
  width: number;
}

const measureCanvas = createCanvas(1, 1);
const measureCtx = measureCanvas.getContext('2d');

export function measureLines(text: string, font: string, maxWidth: number): MeasuredLine[] {
  if (!text || maxWidth <= 0) return [];

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

  return lines;
}

export function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}
