import { createCanvas } from '@napi-rs/canvas';
import { measureLines, measureTextWidth } from './text-measure';
import { FORMATS, type FormatKey } from './formats';
import { getGradientBySlug } from './gradients';
import { getFontByName } from './fonts';

export interface RenderOptions {
  title: string;
  description: string;
  author: string;
  tag: string;
  format: FormatKey;
  accent: string;
  layout: 'left' | 'center' | 'bottom';
  titleSize: number;
  descSize: number;
  fontName: string;
  gradient: string;
  bgImageBuffer: Buffer | null;
  overlayOpacity: number;
}

export interface RenderResult {
  buffer: Buffer;
  width: number;
  height: number;
  titleTotalLines: number;
  titleVisibleLines: number;
  descTotalLines: number;
  descVisibleLines: number;
  overflow: boolean;
}

export function renderCard(options: RenderOptions): RenderResult {
  const {
    title, description, author, tag, format, accent, layout,
    titleSize, descSize, fontName, gradient: gradientSlug,
    bgImageBuffer, overlayOpacity,
  } = options;

  const fmt = FORMATS[format];
  if (!fmt) throw new Error(`Unknown format: ${format}`);

  const W = fmt.w;
  const H = fmt.h;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const s = Math.max(W, H) / 1200;
  const fontEntry = getFontByName(fontName);
  const ff = fontEntry.family;

  // Background: gradient (bgImage support deferred)
  const grad = getGradientBySlug(gradientSlug);
  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, grad.stops[0]);
  bg.addColorStop(1, grad.stops[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = accent + '05';
  ctx.lineWidth = 1;
  const gs = 50 * s;
  for (let x = 0; x < W; x += gs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Glow
  const g1 = ctx.createRadialGradient(W * 0.15, H * 0.8, 0, W * 0.15, H * 0.8, W * 0.35);
  g1.addColorStop(0, accent + '10');
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  // Layout metrics
  const px = Math.round(64 * s);
  const cW = W - px * 2;
  const isCenter = layout === 'center';
  const isBottom = layout === 'bottom';

  // Tag
  const tagFont = `600 ${Math.round(14 * s)}px ${ff}`;
  let tagH = 0;
  if (tag) tagH = 28 * s + 16 * s;

  // Title
  const tFont = `800 ${Math.round(titleSize * s)}px ${ff}`;
  const tLH = Math.round(titleSize * 1.2 * s);
  const tLines = measureLines(title || 'Untitled', tFont, cW);
  const maxT = fmt.maxTitleLines;
  const visibleT = tLines.slice(0, maxT);

  // Description
  const dFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const dLH = Math.round(descSize * 1.55 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const maxD = fmt.maxDescLines;
  const visibleD = dLines.slice(0, maxD);

  // Author
  const aFont = `700 ${Math.round(18 * s)}px ${ff}`;
  const aH = 24 * s;
  const g3v = 20 * s;
  const g4v = 28 * s;
  const totalH = tagH + visibleT.length * tLH + g3v + visibleD.length * dLH + g4v + aH;

  let yPos = isBottom ? H - px - totalH : isCenter ? (H - totalH) / 2 : Math.round(px * 1.2);
  const align: 'left' | 'center' | 'right' = isCenter ? 'center' : 'left';
  const xP = isCenter ? W / 2 : px;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  // Accent bar
  if (!isCenter && !bgImageBuffer) {
    ctx.fillStyle = accent;
    ctx.fillRect(px, yPos, 4 * s, Math.min(visibleT.length * tLH + tagH, 80 * s));
  }

  // Tag pill
  if (tag) {
    ctx.font = tagFont;
    const tagText = tag.toUpperCase();
    const tgW = measureTextWidth(tagText, tagFont);
    const pW = tgW + 24 * s;
    const pH = 28 * s;
    const pX = isCenter ? (W - pW) / 2 : px;
    ctx.fillStyle = accent + '18';
    ctx.beginPath();
    ctx.roundRect(pX, yPos, pW, pH, pH / 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = tagFont;
    ctx.textAlign = 'center';
    ctx.fillText(tagText, pX + pW / 2, yPos + pH / 2 - 7 * s);
    ctx.textAlign = align;
    yPos += tagH;
  }

  // Title lines
  ctx.fillStyle = '#f1f5f9';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '\u2026';
    ctx.fillText(t, xP, yPos);
    yPos += tLH;
  }
  yPos += g3v;

  // Description lines
  ctx.fillStyle = bgImageBuffer ? '#d1d5db' : '#94a3b8';
  ctx.font = dFont;
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > maxD) t += '\u2026';
    ctx.fillText(t, xP, yPos);
    yPos += dLH;
  }
  yPos += g4v;

  // Author
  ctx.fillStyle = accent;
  ctx.font = aFont;
  ctx.fillText(author || '', xP, yPos);

  // Badge
  ctx.fillStyle = accent + '33';
  ctx.font = `500 ${Math.round(12 * s)}px monospace`;
  ctx.textAlign = 'right';
  ctx.fillText('\u26A1 no browser required', W - px, H - px * 0.7);
  ctx.textAlign = 'left';

  // Frame
  ctx.strokeStyle = accent + '12';
  ctx.lineWidth = 1;
  const fr = 24 * s;
  ctx.strokeRect(fr, fr, W - fr * 2, H - fr * 2);

  const overflow = tLines.length > maxT || dLines.length > maxD;

  return {
    buffer: canvas.toBuffer('image/png'),
    width: W,
    height: H,
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
}
