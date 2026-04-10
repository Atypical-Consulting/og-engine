import { measureLines, measureTextWidth } from '../text-measure';
import { drawBgImage, fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const emailBannerTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, overlayOpacity } = input;
  const { title, description, author, tag } = content;
  const { accent, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  const rightGlow = ctx.createRadialGradient(W * 0.88, H * 0.5, 0, W * 0.88, H * 0.5, W * 0.55);
  rightGlow.addColorStop(0, rgba(accent, 0.14));
  rightGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(88 * s);
  const cW = W - px * 2;

  const maxT = Math.min(fmt.maxTitleLines, 2);
  const { lines: tLines, fontSize: eff } = fitTitleLines(title || '', ff, titleSize, 800, cW, maxT, s);
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

  if (tag) {
    ctx.font = `500 ${Math.round(14 * s)}px ${ff}`;
    ctx.fillStyle = accent;
    ctx.fillText(`\u25cf  ${tag}`, px, yPos);
    yPos += tagH + tagGap;
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > maxT) t += '\u2026';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }
  yPos += descGap;

  ctx.fillStyle = 'rgba(203,213,225,0.8)';
  ctx.font = dFont;
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > maxD) t += '\u2026';
    ctx.fillText(t, px, yPos);
    yPos += dLH;
  }

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
    ctx.fillText('\u2192', px + ctaW - 30 * s, yPos + ctaH2 / 2 - 8 * s);
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
