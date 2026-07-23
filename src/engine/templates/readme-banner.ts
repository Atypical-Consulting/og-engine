import { measureLines, measureTextWidth } from '../text-measure';
import { fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const readmeBannerTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style } = input;
  const { title, description } = content;
  const { accent, fontFamily: ff } = style;
  const s = Math.max(W, H) / 1200;

  const owner = input.variables?.owner ?? '';
  const wordmark = input.variables?.wordmark || owner;
  const language = input.variables?.language ?? '';
  const stars = input.variables?.stars ?? '';
  const repoPath = input.variables?.repoPath ?? '';
  const mono = input.variables?.monoFamily || ff;

  // Background: dark void mesh tinted by the language accent.
  paintBackgroundMesh(ctx, W, H, 'void', accent);

  const px = Math.round(80 * s);
  const cW = W - px * 2;
  const topY = Math.round(64 * s);
  const markSize = Math.round(18 * s);

  // --- Top-left: diamond mark + wordmark ---
  ctx.save();
  ctx.translate(px + markSize / 2, topY + markSize / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = accent;
  ctx.fillRect(-markSize / 2, -markSize / 2, markSize, markSize);
  ctx.restore();

  const wmFont = `700 ${Math.round(19 * s)}px ${ff}`;
  ctx.font = wmFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(230,237,243,0.92)';
  ctx.fillText(wordmark.toUpperCase(), px + markSize + Math.round(14 * s), topY + markSize / 2);

  // --- Top-right: language chip (dot + label) ---
  if (language) {
    const chipFont = `600 ${Math.round(16 * s)}px ${ff}`;
    ctx.font = chipFont;
    const labelW = measureTextWidth(language, chipFont);
    const dotR = Math.round(6 * s);
    const padX = Math.round(16 * s);
    const gap = Math.round(9 * s);
    const chipH = Math.round(34 * s);
    const chipW = padX * 2 + dotR * 2 + gap + labelW;
    const chipX = W - px - chipW;
    const chipY = topY + markSize / 2 - chipH / 2;

    ctx.fillStyle = rgba(accent, 0.12);
    roundRect(ctx, chipX, chipY, chipW, chipH, Math.round(chipH / 2));
    ctx.fill();

    const cy = topY + markSize / 2;
    ctx.beginPath();
    ctx.arc(chipX + padX + dotR, cy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();

    ctx.fillStyle = 'rgba(230,237,243,0.92)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = chipFont;
    ctx.fillText(language, chipX + padX + dotR * 2 + gap, cy);
  }

  // --- Repo name (large, bold) ---
  const titleTopY = topY + markSize + Math.round(56 * s);
  const { lines: tLines, fontSize: eff } = fitTitleLines(
    title || '',
    ff,
    style.titleSize,
    800,
    cW,
    fmt.maxTitleLines,
    s,
  );
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.12 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e6edf3';
  ctx.font = tFont;
  let yPos = titleTopY;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '…';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }

  // --- Tagline ---
  const dFont = `400 ${Math.round(style.descSize * s)}px ${ff}`;
  const dLH = Math.round(style.descSize * 1.5 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const visibleD = dLines.slice(0, fmt.maxDescLines);
  yPos += Math.round(18 * s);
  ctx.font = dFont;
  ctx.fillStyle = 'rgba(139,148,158,0.92)';
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > fmt.maxDescLines) t += '…';
    ctx.fillText(t, px, yPos);
    yPos += dLH;
  }

  // --- Bottom bar: separator, mono repo path, star count ---
  const bottomY = H - Math.round(64 * s);
  ctx.strokeStyle = rgba(accent, 0.18);
  ctx.lineWidth = Math.round(1 * s);
  ctx.beginPath();
  ctx.moveTo(px, bottomY - Math.round(22 * s));
  ctx.lineTo(W - px, bottomY - Math.round(22 * s));
  ctx.stroke();

  const pathFont = `500 ${Math.round(16 * s)}px ${mono}`;
  ctx.font = pathFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(139,148,158,0.9)';
  ctx.fillText(repoPath, px, bottomY);

  if (stars) {
    const starFont = `600 ${Math.round(17 * s)}px ${ff}`;
    ctx.font = starFont;
    const starChar = '★';
    const countW = measureTextWidth(stars, starFont);
    const starW = measureTextWidth(starChar, starFont);
    const gap = Math.round(7 * s);
    const totalW = starW + gap + countW;
    const startX = W - px - totalW;
    ctx.textAlign = 'left';
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.fillText(starChar, startX, bottomY);
    ctx.fillStyle = 'rgba(230,237,243,0.9)';
    ctx.fillText(stars, startX + starW + gap, bottomY);
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

function roundRect(
  ctx: import('@napi-rs/canvas').SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
