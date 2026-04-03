export interface MeasuredLine {
  text: string;
  width: number;
}

let _ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D {
  if (!_ctx) {
    const c = document.createElement('canvas');
    _ctx = c.getContext('2d')!;
  }
  return _ctx;
}

export function measureLines(text: string, font: string, maxWidth: number): MeasuredLine[] {
  if (!text || maxWidth <= 0) return [];
  const ctx = getCtx();
  ctx.font = font;
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
      const ww = ctx.measureText(word).width;
      const sp = cur ? ctx.measureText(' ').width : 0;
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
  const ctx = getCtx();
  ctx.font = font;
  return ctx.measureText(text).width;
}
