import { measureLines, measureTextWidth } from '../text-measure';
import { drawBgImage, fitTitleLines, paintBackgroundMesh } from './helpers';
import type { TemplateFn } from './types';

export const blogHeroTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, overlayOpacity } = input;
  const { title, description, author, tag } = content;
  const { accent, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, 0);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  const bottomGrad = ctx.createLinearGradient(0, H * 0.25, 0, H);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.55, `rgba(0,0,0,${overlayOpacity * 0.7})`);
  bottomGrad.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, overlayOpacity + 0.18)})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(84 * s);
  const cW = W - px * 2;

  const { lines: tLines, fontSize: eff } = fitTitleLines(title || '', ff, titleSize, 800, cW, fmt.maxTitleLines, s);
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

  if (tag) {
    ctx.font = `500 ${Math.round(14 * s)}px ${ff}`;
    ctx.fillStyle = accent;
    ctx.fillText(`\u25cf  ${tag}`, px, yPos);
    yPos += tagH + tagGap;
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '\u2026';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }
  yPos += descGap;

  if (description) {
    ctx.fillStyle = 'rgba(226,232,240,0.82)';
    ctx.font = dFont;
    for (let i = 0; i < visibleD.length; i++) {
      let t = visibleD[i].text;
      if (i === visibleD.length - 1 && dLines.length > fmt.maxDescLines) t += '\u2026';
      ctx.fillText(t, px, yPos);
      yPos += dLH;
    }
    yPos += authorGap;
  }

  if (author) {
    const aFont = `500 ${Math.round(15 * s)}px ${ff}`;
    ctx.font = aFont;
    ctx.fillStyle = accent;
    ctx.fillText('\u2014 ', px, yPos);
    const dashW = measureTextWidth('\u2014 ', aFont);
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
};
