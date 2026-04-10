import { drawBgImage, fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const socialCardTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, overlayOpacity } = input;
  const { title, author, tag } = content;
  const { accent, fontFamily: ff, titleSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  const gcenter = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
  gcenter.addColorStop(0, rgba(accent, 0.14));
  gcenter.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gcenter;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(110 * s);
  const cW = W - px * 2;

  const bigSize = Math.round(titleSize * 1.3);
  const { lines: tLines, fontSize: eff } = fitTitleLines(title || '', ff, bigSize, 800, cW, fmt.maxTitleLines, s);
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.06 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);
  const totalTextH = visibleT.length * tLH;

  if (tag) {
    ctx.font = `500 ${Math.round(15 * s)}px ${ff}`;
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`\u25cf  ${tag}`, W / 2, (H - totalTextH) / 2 - 52 * s);
  }

  let yPos = (H - totalTextH) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '\u2026';
    ctx.fillText(t, W / 2, yPos);
    yPos += tLH;
  }

  if (author) {
    ctx.font = `500 ${Math.round(17 * s)}px ${ff}`;
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.textAlign = 'center';
    ctx.fillText(`\u2014 ${author}`, W / 2, H - px * 0.6);
  }

  const overflow = tLines.length > fmt.maxTitleLines;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: 0,
    descVisibleLines: 0,
    overflow,
  };
};
