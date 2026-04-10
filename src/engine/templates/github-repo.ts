import { measureLines, measureTextWidth } from '../text-measure';
import { fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const githubRepoTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, namedImages } = input;
  const { title, description } = content;
  const { accent, fontFamily: ff } = style;
  // Force dark GitHub aesthetic — always use void gradient regardless of user choice
  const s = Math.max(W, H) / 1200;

  const stars = input.variables?.stars ?? '';
  const language = input.variables?.language ?? '';
  const owner = input.variables?.owner ?? '';

  const avatar = namedImages?.avatar ?? null;

  // Background — force void dark theme
  paintBackgroundMesh(ctx, W, H, 'void', accent);

  // Subtle grid lines overlay for GitHub-like feel
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gridStep = Math.round(48 * s);
  for (let x = 0; x < W; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Layout constants
  const px = Math.round(80 * s);
  const cW = W - px * 2;
  const topY = Math.round(72 * s);

  // --- Avatar (circular) + owner/repo line ---
  const avatarRadius = Math.round(28 * s);
  const avatarDiameter = avatarRadius * 2;
  let avatarEndX = px;

  if (avatar) {
    const cx = px + avatarRadius;
    const cy = topY + avatarRadius;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, cx - avatarRadius, cy - avatarRadius, avatarDiameter, avatarDiameter);
    ctx.restore();
    avatarEndX = cx + avatarRadius + Math.round(16 * s);
  }

  // Owner label (muted) next to avatar
  if (owner) {
    const ownerFont = `500 ${Math.round(18 * s)}px ${ff}`;
    ctx.font = ownerFont;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(139,148,158,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(owner, avatarEndX, topY + avatarRadius);
  }

  // --- Repo name (large, bold, monospace-feel via heavy weight) ---
  const titleTopY = topY + avatarDiameter + Math.round(32 * s);
  const { lines: tLines, fontSize: eff } = fitTitleLines(
    title || '',
    ff,
    style.titleSize,
    900,
    cW,
    fmt.maxTitleLines,
    s,
  );
  const tFont = `900 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.1 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e6edf3';
  ctx.font = tFont;
  let yPos = titleTopY;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '\u2026';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }

  // --- Description ---
  const descGap = Math.round(20 * s);
  const dFont = `400 ${Math.round(style.descSize * s)}px ${ff}`;
  const dLH = Math.round(style.descSize * 1.55 * s);
  const dLines = measureLines(description || '', dFont, cW);
  const visibleD = dLines.slice(0, fmt.maxDescLines);

  yPos += descGap;
  ctx.font = dFont;
  ctx.fillStyle = 'rgba(139,148,158,0.88)';
  for (let i = 0; i < visibleD.length; i++) {
    let t = visibleD[i].text;
    if (i === visibleD.length - 1 && dLines.length > fmt.maxDescLines) t += '\u2026';
    ctx.fillText(t, px, yPos);
    yPos += dLH;
  }

  // --- Bottom bar: language dot + name, star icon + count ---
  const bottomY = H - Math.round(72 * s);
  const barFont = `500 ${Math.round(17 * s)}px ${ff}`;
  ctx.font = barFont;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Accent-colored separator line above bottom bar
  ctx.strokeStyle = rgba(accent, 0.18);
  ctx.lineWidth = Math.round(1 * s);
  ctx.beginPath();
  ctx.moveTo(px, bottomY - Math.round(20 * s));
  ctx.lineTo(W - px, bottomY - Math.round(20 * s));
  ctx.stroke();

  let barX = px;

  // Language dot + label
  if (language) {
    const dotRadius = Math.round(7 * s);
    ctx.beginPath();
    ctx.arc(barX + dotRadius, bottomY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    barX += dotRadius * 2 + Math.round(8 * s);

    ctx.fillStyle = 'rgba(230,237,243,0.9)';
    ctx.fillText(language, barX, bottomY);
    barX += measureTextWidth(language, barFont) + Math.round(36 * s);
  }

  // Star icon (unicode ★) + count
  if (stars) {
    const starFont = `500 ${Math.round(17 * s)}px ${ff}`;
    ctx.font = starFont;
    ctx.fillStyle = rgba(accent, 0.85);
    const starChar = '\u2605'; // ★
    ctx.fillText(starChar, barX, bottomY);
    barX += measureTextWidth(starChar, starFont) + Math.round(6 * s);

    ctx.fillStyle = 'rgba(230,237,243,0.9)';
    ctx.fillText(stars, barX, bottomY);
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
