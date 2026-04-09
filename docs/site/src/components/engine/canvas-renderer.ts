import { measureLines, measureTextWidth } from './text-measure';
import { FORMATS, type FormatKey } from './formats';
import type { Gradient } from './gradients';
import type { FontEntry } from './fonts';

export interface RenderOptions {
  title: string;
  description: string;
  author: string;
  tag: string;
  format: FormatKey;
  template: string;
  accent: string;
  layout: 'left' | 'center' | 'bottom';
  titleSize: number;
  descSize: number;
  fontEntry: FontEntry;
  gradient: Gradient;
  bgImage: HTMLImageElement | null;
  overlayOpacity: number;
}

export interface RenderResult {
  titleTotalLines: number;
  titleVisibleLines: number;
  descTotalLines: number;
  descVisibleLines: number;
  overflow: boolean;
}

// ───────────────────────────── helpers ─────────────────────────────

type Ctx2D = CanvasRenderingContext2D;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const i = Number.parseInt(n, 16);
  return [(i >> 16) & 255, (i >> 8) & 255, i & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Paint the canonical background: vertical base + accent pool + cool shadow + sheen. */
export function paintBackgroundMesh(
  ctx: Ctx2D,
  W: number,
  H: number,
  gradient: Gradient,
  accent: string,
) {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, gradient.stops[0]);
  base.addColorStop(1, gradient.stops[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Top-left accent bloom
  const g1 = ctx.createRadialGradient(W * 0.2, H * 0.18, 0, W * 0.2, H * 0.18, Math.max(W, H) * 0.6);
  g1.addColorStop(0, rgba(accent, 0.22));
  g1.addColorStop(0.5, rgba(accent, 0.06));
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  // Bottom-right cool bloom
  const g2 = ctx.createRadialGradient(W * 0.88, H * 0.95, 0, W * 0.88, H * 0.95, W * 0.55);
  g2.addColorStop(0, rgba(accent, 0.1));
  g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Soft diagonal sheen
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'transparent');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
}

function drawBgImageCover(ctx: Ctx2D, img: HTMLImageElement, W: number, H: number) {
  const iw = img.width;
  const ih = img.height;
  const scale = Math.max(W / iw, H / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function fitTitleLines(
  ctx: Ctx2D,
  text: string,
  family: string,
  baseSize: number,
  weight: number,
  cW: number,
  maxLines: number,
  scale: number,
): { lines: ReturnType<typeof measureLines>; fontSize: number } {
  // Shrink the title until it fits the max line count. Between base and 70% of base.
  let size = baseSize;
  const min = Math.max(20, Math.round(baseSize * 0.7));
  while (size > min) {
    const font = `${weight} ${Math.round(size * scale)}px ${family}`;
    const lines = measureLines(text, font, cW);
    if (lines.length <= maxLines) return { lines, fontSize: size };
    size -= 2;
  }
  const font = `${weight} ${Math.round(size * scale)}px ${family}`;
  return { lines: measureLines(text, font, cW), fontSize: size };
}

// ─────────────────────── DEFAULT template ──────────────────────────
// Editorial. Quiet. Ship-ready. Title does the work. No tool-noise.

function renderDefault(canvas: HTMLCanvasElement, opts: RenderOptions): RenderResult {
  const {
    title, description, author, tag, format, accent, layout,
    titleSize, descSize, fontEntry, gradient, bgImage, overlayOpacity,
  } = opts;
  const fmt = FORMATS[format];
  const W = fmt.w;
  const H = fmt.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const s = Math.max(W, H) / 1200;
  const ff = fontEntry.family;

  // ─── Background ───
  if (bgImage) {
    drawBgImageCover(ctx, bgImage, W, H);
    ctx.fillStyle = `rgba(6,8,12,${overlayOpacity})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgba(accent, 0.05);
    ctx.fillRect(0, 0, W, H);
  } else {
    paintBackgroundMesh(ctx, W, H, gradient, accent);
  }

  const px = Math.round(84 * s);
  const cW = W - px * 2;
  const isCenter = layout === 'center';
  const isBottom = layout === 'bottom';

  // ─── Measure with auto-shrink ───
  const { lines: tLines, fontSize: effectiveTitle } = fitTitleLines(
    ctx, title || '', ff, titleSize, 800, cW, fmt.maxTitleLines, s,
  );
  const tFont = `800 ${Math.round(effectiveTitle * s)}px ${ff}`;
  const tLH = Math.round(effectiveTitle * 1.08 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);

  const dFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const dLH = Math.round(descSize * 1.5 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const visibleD = dLines.slice(0, fmt.maxDescLines);

  // ─── Compose vertical block ───
  const tagFont = `600 ${Math.round(14 * s)}px ${ff}`;
  const tagH = tag ? 26 * s : 0;
  const tagGap = tag ? 24 * s : 0;
  const descGap = visibleD.length ? 24 * s : 0;
  const authorGap = author ? 40 * s : 0;
  const authorH = author ? 20 * s : 0;
  const totalH =
    tagH + tagGap +
    visibleT.length * tLH +
    descGap + visibleD.length * dLH +
    authorGap + authorH;

  let yPos = isBottom
    ? H - px - totalH
    : isCenter
      ? (H - totalH) / 2
      : Math.round(px * 1.1);

  const align: CanvasTextAlign = isCenter ? 'center' : 'left';
  const xP = isCenter ? W / 2 : px;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  // ─── Tag (subtle, no gimmicks) ───
  if (tag) {
    ctx.font = tagFont;
    ctx.fillStyle = accent;
    // A tiny leading dot, then the tag name in the brand font — not mono, not shouty caps
    const dot = '●';
    const tagText = tag;
    if (isCenter) {
      const dotW = measureTextWidth(dot + '  ', tagFont);
      const tgW = measureTextWidth(tagText, tagFont);
      const totalW = dotW + tgW;
      const startX = W / 2 - totalW / 2;
      ctx.textAlign = 'left';
      ctx.fillText(dot, startX, yPos + 2 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(tagText, startX + dotW, yPos + 2 * s);
      ctx.textAlign = align;
    } else {
      ctx.fillText(dot, xP, yPos + 2 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(tagText, xP + measureTextWidth(dot + '  ', tagFont), yPos + 2 * s);
    }
    yPos += tagH + tagGap;
  }

  // ─── Title ───
  ctx.fillStyle = '#f8fafc';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '…';
    ctx.fillText(t, xP, yPos);
    yPos += tLH;
  }
  yPos += descGap;

  // ─── Description ───
  ctx.fillStyle = bgImage ? 'rgba(226,232,240,0.88)' : 'rgba(203,213,225,0.78)';
  ctx.font = dFont;
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > fmt.maxDescLines) t += '…';
    ctx.fillText(t, xP, yPos);
    yPos += dLH;
  }
  yPos += authorGap;

  // ─── Author — proper human byline in the chosen font, not caps, not mono ───
  if (author) {
    const aFont = `500 ${Math.round(16 * s)}px ${ff}`;
    ctx.font = aFont;
    // Small accent bullet + name
    const bullet = '—';
    const name = ` ${author}`;
    if (isCenter) {
      const bw = measureTextWidth(bullet + name, aFont);
      const startX = W / 2 - bw / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = accent;
      ctx.fillText(bullet, startX, yPos);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(name, startX + measureTextWidth(bullet, aFont), yPos);
      ctx.textAlign = align;
    } else {
      ctx.fillStyle = accent;
      ctx.fillText(bullet, xP, yPos);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(name, xP + measureTextWidth(bullet, aFont), yPos);
    }
  }

  const overflow = tLines.length > fmt.maxTitleLines || dLines.length > fmt.maxDescLines;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
}

// ─────────────────────── SOCIAL-CARD template ──────────────────────
// Centered, oversized, confident. Nothing else.

function renderSocialCard(canvas: HTMLCanvasElement, opts: RenderOptions): RenderResult {
  const { title, author, tag, format, accent, titleSize, fontEntry, gradient, bgImage, overlayOpacity } = opts;
  const fmt = FORMATS[format];
  const W = fmt.w;
  const H = fmt.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const s = Math.max(W, H) / 1200;
  const ff = fontEntry.family;

  if (bgImage) {
    drawBgImageCover(ctx, bgImage, W, H);
    ctx.fillStyle = `rgba(6,8,12,${overlayOpacity})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    paintBackgroundMesh(ctx, W, H, gradient, accent);
  }

  // Extra center bloom
  const gcenter = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
  gcenter.addColorStop(0, rgba(accent, 0.14));
  gcenter.addColorStop(1, 'transparent');
  ctx.fillStyle = gcenter;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(110 * s);
  const cW = W - px * 2;

  const bigSize = Math.round(titleSize * 1.3);
  const { lines: tLines, fontSize: eff } = fitTitleLines(ctx, title || '', ff, bigSize, 800, cW, fmt.maxTitleLines, s);
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.06 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);
  const totalTextH = visibleT.length * tLH;

  // Tag above title — lowercase, subtle
  if (tag) {
    ctx.font = `500 ${Math.round(15 * s)}px ${ff}`;
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`●  ${tag}`, W / 2, (H - totalTextH) / 2 - 52 * s);
  }

  // Title
  let yPos = (H - totalTextH) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '…';
    ctx.fillText(t, W / 2, yPos);
    yPos += tLH;
  }

  // Author at bottom — normal case, in chosen font
  if (author) {
    ctx.font = `500 ${Math.round(17 * s)}px ${ff}`;
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.textAlign = 'center';
    ctx.fillText(`— ${author}`, W / 2, H - px * 0.6);
  }

  const overflow = tLines.length > fmt.maxTitleLines;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: 0,
    descVisibleLines: 0,
    overflow,
  };
}

// ─────────────────────── BLOG-HERO template ────────────────────────
// Bottom lockup, cinematic gradient. Editorial, not architectural.

function renderBlogHero(canvas: HTMLCanvasElement, opts: RenderOptions): RenderResult {
  const {
    title, description, author, tag, format, accent, titleSize, descSize,
    fontEntry, gradient, bgImage, overlayOpacity,
  } = opts;
  const fmt = FORMATS[format];
  const W = fmt.w;
  const H = fmt.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const s = Math.max(W, H) / 1200;
  const ff = fontEntry.family;

  if (bgImage) {
    drawBgImageCover(ctx, bgImage, W, H);
  } else {
    paintBackgroundMesh(ctx, W, H, gradient, accent);
  }

  // Strong bottom fade for legibility
  const bottomGrad = ctx.createLinearGradient(0, H * 0.25, 0, H);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.55, `rgba(0,0,0,${overlayOpacity * 0.7})`);
  bottomGrad.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, overlayOpacity + 0.18)})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(84 * s);
  const cW = W - px * 2;

  // Measure
  const { lines: tLines, fontSize: eff } = fitTitleLines(ctx, title || '', ff, titleSize, 800, cW, fmt.maxTitleLines, s);
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.08 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);

  const dFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const dLH = Math.round(descSize * 1.5 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const visibleD = dLines.slice(0, fmt.maxDescLines);

  const tagH = tag ? 24 * s : 0;
  const tagGap = tag ? 22 * s : 0;
  const descGap = description ? 20 * s : 0;
  const authorGap = author ? 32 * s : 0;
  const authorH = author ? 20 * s : 0;
  const totalH = tagH + tagGap + visibleT.length * tLH + descGap + visibleD.length * dLH + authorGap + authorH;
  let yPos = H - px - totalH;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Tag — small bullet + name, in brand font
  if (tag) {
    ctx.font = `500 ${Math.round(14 * s)}px ${ff}`;
    ctx.fillStyle = accent;
    ctx.fillText(`●  ${tag}`, px, yPos);
    yPos += tagH + tagGap;
  }

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '…';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }
  yPos += descGap;

  // Description
  if (description) {
    ctx.fillStyle = 'rgba(226,232,240,0.82)';
    ctx.font = dFont;
    for (let i = 0; i < visibleD.length; i++) {
      let t = visibleD[i].text;
      if (i === visibleD.length - 1 && dLines.length > fmt.maxDescLines) t += '…';
      ctx.fillText(t, px, yPos);
      yPos += dLH;
    }
    yPos += authorGap;
  }

  // Author
  if (author) {
    ctx.font = `500 ${Math.round(15 * s)}px ${ff}`;
    ctx.fillStyle = accent;
    ctx.fillText('— ', px, yPos);
    const dashW = measureTextWidth('— ', ctx.font);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(author, px + dashW, yPos);
  }

  const overflow = tLines.length > fmt.maxTitleLines || dLines.length > fmt.maxDescLines;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
}

// ────────────────────── EMAIL-BANNER template ──────────────────────
// Horizontal. CTA. Warm and direct.

function renderEmailBanner(canvas: HTMLCanvasElement, opts: RenderOptions): RenderResult {
  const {
    title, description, author, tag, format, accent, titleSize, descSize,
    fontEntry, gradient, bgImage, overlayOpacity,
  } = opts;
  const fmt = FORMATS[format];
  const W = fmt.w;
  const H = fmt.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const s = Math.max(W, H) / 1200;
  const ff = fontEntry.family;

  if (bgImage) {
    drawBgImageCover(ctx, bgImage, W, H);
    ctx.fillStyle = `rgba(6,8,12,${overlayOpacity})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    paintBackgroundMesh(ctx, W, H, gradient, accent);
  }

  // Right-side accent wash (softer than before, no sharp diagonal)
  const rightGlow = ctx.createRadialGradient(W * 0.88, H * 0.5, 0, W * 0.88, H * 0.5, W * 0.55);
  rightGlow.addColorStop(0, rgba(accent, 0.14));
  rightGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(88 * s);
  const cW = W - px * 2;

  // Measure
  const maxT = Math.min(fmt.maxTitleLines, 2);
  const { lines: tLines, fontSize: eff } = fitTitleLines(ctx, title || '', ff, titleSize, 800, cW, maxT, s);
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.1 * s);
  const visibleT = tLines.slice(0, maxT);

  const dFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const dLH = Math.round(descSize * 1.5 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const maxD = Math.min(fmt.maxDescLines, 2);
  const visibleD = dLines.slice(0, maxD);

  const tagH = tag ? 22 * s : 0;
  const tagGap = tag ? 18 * s : 0;
  const descGap = 16 * s;
  const ctaGap = author ? 30 * s : 0;
  const ctaH = author ? 52 * s : 0;
  const totalH = tagH + tagGap + visibleT.length * tLH + descGap + visibleD.length * dLH + ctaGap + ctaH;
  let yPos = (H - totalH) / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Tag
  if (tag) {
    ctx.font = `500 ${Math.round(14 * s)}px ${ff}`;
    ctx.fillStyle = accent;
    ctx.fillText(`●  ${tag}`, px, yPos);
    yPos += tagH + tagGap;
  }

  // Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '…';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }
  yPos += descGap;

  // Description
  ctx.fillStyle = 'rgba(203,213,225,0.8)';
  ctx.font = dFont;
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > maxD) t += '…';
    ctx.fillText(t, px, yPos);
    yPos += dLH;
  }

  // CTA button — full-weight, confident
  if (author) {
    yPos += ctaGap;
    const ctaFont = `700 ${Math.round(16 * s)}px ${ff}`;
    ctx.font = ctaFont;
    const label = author;
    const ctaW = measureTextWidth(label, ctaFont) + 64 * s;
    const ctaH2 = 52 * s;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(px, yPos, ctaW, ctaH2, 10 * s);
    ctx.fill();
    ctx.fillStyle = '#06080c';
    ctx.textAlign = 'left';
    ctx.fillText(label, px + 24 * s, yPos + ctaH2 / 2 - 8 * s);
    ctx.fillText('→', px + ctaW - 30 * s, yPos + ctaH2 / 2 - 8 * s);
  }

  const overflow = tLines.length > maxT || dLines.length > maxD;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
}

// ─────────────────────────── dispatcher ────────────────────────────

export function renderCard(canvas: HTMLCanvasElement, options: RenderOptions): RenderResult {
  switch (options.template) {
    case 'social-card':
      return renderSocialCard(canvas, options);
    case 'blog-hero':
      return renderBlogHero(canvas, options);
    case 'email-banner':
      return renderEmailBanner(canvas, options);
    default:
      return renderDefault(canvas, options);
  }
}
