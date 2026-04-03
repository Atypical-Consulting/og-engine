import type { Canvas, Image, SKRSContext2D } from '@napi-rs/canvas';
import type { Format } from './formats';
import { getGradientBySlug } from './gradients';
import { measureLines, measureTextWidth } from './text-measure';

export interface TemplateInput {
  canvas: Canvas;
  ctx: SKRSContext2D;
  width: number;
  height: number;
  format: Format;
  content: {
    title: string;
    description: string;
    author: string;
    tag: string;
  };
  style: {
    accent: string;
    layout: 'left' | 'center' | 'bottom';
    fontFamily: string;
    titleSize: number;
    descSize: number;
    gradient: string;
  };
  bgImage: Image | null;
  overlayOpacity: number;
}

export interface TemplateResult {
  titleTotalLines: number;
  titleVisibleLines: number;
  descTotalLines: number;
  descVisibleLines: number;
  overflow: boolean;
}

export type TemplateFn = (input: TemplateInput) => TemplateResult;

// ─── Shared helpers ──────────────────────────────────────────

function drawBackground(ctx: SKRSContext2D, w: number, h: number, gradientSlug: string) {
  const grad = getGradientBySlug(gradientSlug);
  const bg = ctx.createLinearGradient(0, 0, w * 0.3, h);
  bg.addColorStop(0, grad.stops[0]);
  bg.addColorStop(1, grad.stops[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}

function drawBgImage(ctx: SKRSContext2D, img: Image, w: number, h: number, opacity: number) {
  // Draw image scaled to cover
  const imgW = img.width;
  const imgH = img.height;
  const scale = Math.max(w / imgW, h / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  // Dark overlay
  ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx: SKRSContext2D, w: number, h: number, accent: string, s: number) {
  ctx.strokeStyle = `${accent}05`;
  ctx.lineWidth = 1;
  const gs = 50 * s;
  for (let x = 0; x < w; x += gs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawGlow(ctx: SKRSContext2D, w: number, h: number, accent: string) {
  const g = ctx.createRadialGradient(w * 0.15, h * 0.8, 0, w * 0.15, h * 0.8, w * 0.35);
  g.addColorStop(0, `${accent}10`);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawFrame(ctx: SKRSContext2D, w: number, h: number, accent: string, s: number) {
  ctx.strokeStyle = `${accent}12`;
  ctx.lineWidth = 1;
  const fr = 24 * s;
  ctx.strokeRect(fr, fr, w - fr * 2, h - fr * 2);
}

function drawBadge(ctx: SKRSContext2D, w: number, h: number, accent: string, s: number, px: number) {
  ctx.fillStyle = `${accent}33`;
  ctx.font = `500 ${Math.round(12 * s)}px monospace`;
  ctx.textAlign = 'right';
  ctx.fillText('\u26A1 no browser required', w - px, h - px * 0.7);
  ctx.textAlign = 'left';
}

// ─── DEFAULT template ────────────────────────────────────────

const defaultTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, overlayOpacity } = input;
  const { title, description, author, tag } = content;
  const { accent, layout, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  // Background
  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
  } else {
    drawBackground(ctx, W, H, gradientSlug);
  }
  drawGrid(ctx, W, H, accent, s);
  drawGlow(ctx, W, H, accent);

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
  const align: CanvasTextAlign = isCenter ? 'center' : 'left';
  const xP = isCenter ? W / 2 : px;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  // Accent bar
  if (!isCenter && !bgImage) {
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
    ctx.fillStyle = `${accent}18`;
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

  // Title
  ctx.fillStyle = '#f1f5f9';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '\u2026';
    ctx.fillText(t, xP, yPos);
    yPos += tLH;
  }
  yPos += g3v;

  // Description
  ctx.fillStyle = bgImage ? '#d1d5db' : '#94a3b8';
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

  // Badge + Frame
  drawBadge(ctx, W, H, accent, s, px);
  drawFrame(ctx, W, H, accent, s);

  const overflow = tLines.length > maxT || dLines.length > maxD;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
};

// ─── SOCIAL-CARD template ────────────────────────────────────
// Large centered title, minimal design, no description by default

const socialCardTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, overlayOpacity } = input;
  const { title, author, tag } = content;
  const { accent, fontFamily: ff, titleSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
  } else {
    drawBackground(ctx, W, H, gradientSlug);
  }

  // Subtle radial glow in center
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.5);
  g.addColorStop(0, `${accent}08`);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(80 * s);
  const cW = W - px * 2;

  // Title — large, centered
  const bigSize = Math.round(titleSize * 1.15);
  const tFont = `800 ${Math.round(bigSize * s)}px ${ff}`;
  const tLH = Math.round(bigSize * 1.15 * s);
  const tLines = measureLines(title || 'Untitled', tFont, cW);
  const maxT = fmt.maxTitleLines;
  const visibleT = tLines.slice(0, maxT);

  const totalTextH = visibleT.length * tLH;
  let yPos = (H - totalTextH) / 2 - 20 * s;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '\u2026';
    ctx.fillText(t, W / 2, yPos);
    yPos += tLH;
  }

  // Tag pill above title
  if (tag) {
    const tagFont = `600 ${Math.round(13 * s)}px ${ff}`;
    ctx.font = tagFont;
    const tagText = tag.toUpperCase();
    const tgW = measureTextWidth(tagText, tagFont);
    const pW = tgW + 28 * s;
    const pH = 26 * s;
    const pX = (W - pW) / 2;
    const pY = (H - totalTextH) / 2 - 20 * s - pH - 16 * s;
    ctx.fillStyle = `${accent}20`;
    ctx.beginPath();
    ctx.roundRect(pX, pY, pW, pH, pH / 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.fillText(tagText, W / 2, pY + pH / 2 - 7 * s);
  }

  // Author at bottom center
  if (author) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(16 * s)}px ${ff}`;
    ctx.textAlign = 'center';
    ctx.fillText(author, W / 2, H - px * 0.8);
  }

  // Accent line under title
  ctx.fillStyle = accent;
  ctx.fillRect(W / 2 - 30 * s, yPos + 12 * s, 60 * s, 3 * s);

  drawFrame(ctx, W, H, accent, s);

  const overflow = tLines.length > maxT;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: 0,
    descVisibleLines: 0,
    overflow,
  };
};

// ─── BLOG-HERO template ─────────────────────────────────────
// Background image focused, text overlay at bottom

const blogHeroTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, overlayOpacity } = input;
  const { title, description, author, tag } = content;
  const { accent, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  // Background — image preferred, gradient fallback
  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, 0); // no full overlay
  } else {
    drawBackground(ctx, W, H, gradientSlug);
    drawGrid(ctx, W, H, accent, s);
  }

  // Bottom gradient overlay for text legibility
  const bottomGrad = ctx.createLinearGradient(0, H * 0.35, 0, H);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.5, `rgba(0,0,0,${overlayOpacity * 0.6})`);
  bottomGrad.addColorStop(1, `rgba(0,0,0,${overlayOpacity})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(64 * s);
  const cW = W - px * 2;

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

  // Calculate bottom-anchored position
  const aH = author ? 24 * s : 0;
  const g3v = description ? 16 * s : 0;
  const g4v = author ? 20 * s : 0;
  const totalH = visibleT.length * tLH + g3v + visibleD.length * dLH + g4v + aH;
  let yPos = H - px - totalH;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Tag pill (top-left floating)
  if (tag) {
    const tagFont = `600 ${Math.round(13 * s)}px ${ff}`;
    ctx.font = tagFont;
    const tagText = tag.toUpperCase();
    const tgW = measureTextWidth(tagText, tagFont);
    const pW = tgW + 24 * s;
    const pH = 26 * s;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(px, px, pW, pH, pH / 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(tagText, px + pW / 2, px + pH / 2 - 7 * s);
    ctx.textAlign = 'left';
  }

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '\u2026';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }
  yPos += g3v;

  // Description
  if (description) {
    ctx.fillStyle = '#d1d5db';
    ctx.font = dFont;
    for (let i = 0; i < visibleD.length; i++) {
      let t = visibleD[i].text;
      if (i === visibleD.length - 1 && dLines.length > maxD) t += '\u2026';
      ctx.fillText(t, px, yPos);
      yPos += dLH;
    }
    yPos += g4v;
  }

  // Author
  if (author) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(16 * s)}px ${ff}`;
    ctx.fillText(author, px, yPos);
  }

  const overflow = tLines.length > maxT || dLines.length > maxD;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
};

// ─── EMAIL-BANNER template ──────────────────────────────────
// Horizontal layout with CTA-style design

const emailBannerTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, overlayOpacity } = input;
  const { title, description, author } = content;
  const { accent, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
  } else {
    drawBackground(ctx, W, H, gradientSlug);
  }

  // Accent strip on left
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 6 * s, H);

  // Subtle horizontal gradient accent
  const hg = ctx.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, `${accent}0a`);
  hg.addColorStop(1, 'transparent');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(64 * s);
  const leftPad = px + 10 * s; // extra for accent strip
  const cW = W - leftPad - px;

  // Title
  const tFont = `800 ${Math.round(titleSize * s)}px ${ff}`;
  const tLH = Math.round(titleSize * 1.2 * s);
  const tLines = measureLines(title || 'Untitled', tFont, cW);
  const maxT = Math.min(fmt.maxTitleLines, 2); // email banners: max 2 title lines
  const visibleT = tLines.slice(0, maxT);

  // Description
  const dFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const dLH = Math.round(descSize * 1.55 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const maxD = Math.min(fmt.maxDescLines, 2); // email banners: max 2 desc lines
  const visibleD = dLines.slice(0, maxD);

  // Vertically center content
  const g3v = 12 * s;
  const ctaH = author ? 44 * s : 0;
  const ctaGap = author ? 24 * s : 0;
  const totalH = visibleT.length * tLH + g3v + visibleD.length * dLH + ctaGap + ctaH;
  let yPos = (H - totalH) / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Title
  ctx.fillStyle = '#f1f5f9';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '\u2026';
    ctx.fillText(t, leftPad, yPos);
    yPos += tLH;
  }
  yPos += g3v;

  // Description
  ctx.fillStyle = '#94a3b8';
  ctx.font = dFont;
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > maxD) t += '\u2026';
    ctx.fillText(t, leftPad, yPos);
    yPos += dLH;
  }

  // CTA button (using author as CTA text)
  if (author) {
    yPos += ctaGap;
    const ctaFont = `700 ${Math.round(15 * s)}px ${ff}`;
    ctx.font = ctaFont;
    const ctaW = measureTextWidth(author, ctaFont) + 40 * s;
    const ctaH2 = 40 * s;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(leftPad, yPos, ctaW, ctaH2, 6 * s);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(author, leftPad + ctaW / 2, yPos + ctaH2 / 2 - 8 * s);
    ctx.textAlign = 'left';
  }

  drawFrame(ctx, W, H, accent, s);

  const overflow = tLines.length > maxT || dLines.length > maxD;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: dLines.length,
    descVisibleLines: visibleD.length,
    overflow,
  };
};

// ─── Template registry ───────────────────────────────────────

export const TEMPLATES: Record<string, TemplateFn> = {
  default: defaultTemplate,
  'social-card': socialCardTemplate,
  'blog-hero': blogHeroTemplate,
  'email-banner': emailBannerTemplate,
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

export function getTemplate(name: string): TemplateFn {
  return TEMPLATES[name] ?? TEMPLATES.default;
}
