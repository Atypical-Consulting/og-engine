import { measureLines, measureTextWidth } from '../text-measure';
import { drawBgImage, fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const defaultTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, overlayOpacity } = input;
  const { title, description, author, tag } = content;
  const { accent, layout, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
    ctx.fillStyle = rgba(accent, 0.05);
    ctx.fillRect(0, 0, W, H);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  const px = Math.round(84 * s);
  const cW = W - px * 2;
  const isCenter = layout === 'center';
  const isBottom = layout === 'bottom';

  const { lines: tLines, fontSize: eff } = fitTitleLines(title || '', ff, titleSize, 800, cW, fmt.maxTitleLines, s);
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.08 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);

  const dFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const dLH = Math.round(descSize * 1.5 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const visibleD = dLines.slice(0, fmt.maxDescLines);

  const tagFont = `600 ${Math.round(14 * s)}px ${ff}`;
  const tagH = tag ? 26 * s : 0;
  const tagGap = tag ? 24 * s : 0;
  const descGap = visibleD.length ? 24 * s : 0;
  const authorGap = author ? 40 * s : 0;
  const authorH = author ? 20 * s : 0;
  const totalH = tagH + tagGap + visibleT.length * tLH + descGap + visibleD.length * dLH + authorGap + authorH;

  let yPos = isBottom ? H - px - totalH : isCenter ? (H - totalH) / 2 : Math.round(px * 1.1);
  const align: CanvasTextAlign = isCenter ? 'center' : 'left';
  const xP = isCenter ? W / 2 : px;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  if (tag) {
    ctx.font = tagFont;
    const dot = '\u25cf';
    const tagText = tag;
    if (isCenter) {
      const dotW = measureTextWidth(`${dot}  `, tagFont);
      const tgW = measureTextWidth(tagText, tagFont);
      const startX = W / 2 - (dotW + tgW) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = accent;
      ctx.fillText(dot, startX, yPos + 2 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(tagText, startX + dotW, yPos + 2 * s);
      ctx.textAlign = align;
    } else {
      ctx.fillStyle = accent;
      ctx.fillText(dot, xP, yPos + 2 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(tagText, xP + measureTextWidth(`${dot}  `, tagFont), yPos + 2 * s);
    }
    yPos += tagH + tagGap;
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '\u2026';
    ctx.fillText(t, xP, yPos);
    yPos += tLH;
  }
  yPos += descGap;

  ctx.fillStyle = bgImage ? 'rgba(226,232,240,0.88)' : 'rgba(203,213,225,0.78)';
  ctx.font = dFont;
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > fmt.maxDescLines) t += '\u2026';
    ctx.fillText(t, xP, yPos);
    yPos += dLH;
  }
  yPos += authorGap;

  if (author) {
    const aFont = `500 ${Math.round(16 * s)}px ${ff}`;
    ctx.font = aFont;
    const bullet = '\u2014';
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
};
