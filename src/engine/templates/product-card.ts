import { measureTextWidth } from '../text-measure';
import { drawBgImage, fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const productCardTemplate: TemplateFn = (input) => {
  const {
    ctx,
    width: W,
    height: H,
    format: fmt,
    content,
    style,
    bgImage,
    overlayOpacity,
    variables,
    namedImages,
  } = input;
  const { title } = content;
  const { accent, fontFamily: ff, titleSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  const price = variables?.price ?? '';
  const badge = variables?.badge ?? '';
  const brand = variables?.brand ?? '';
  const productImage = namedImages?.product ?? null;
  const logoImage = namedImages?.logo ?? null;

  // ── Layout dimensions ────────────────────────────────────────────────────
  const hasProduct = productImage !== null;
  const px = Math.round(72 * s);

  // Split: left 60%, right 40%
  const rightColW = hasProduct ? Math.round(W * 0.4) : 0;
  const leftColW = W - rightColW;
  const contentW = leftColW - px * 2;

  // ── Background ────────────────────────────────────────────────────────────
  if (!hasProduct && bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
    ctx.fillStyle = rgba(accent, 0.05);
    ctx.fillRect(0, 0, W, H);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  // ── Product image (right side) ────────────────────────────────────────────
  if (hasProduct && productImage) {
    const imgX = leftColW;
    const imgW = rightColW;
    const imgH = H;

    // Cover-fit
    const iw = productImage.width;
    const ih = productImage.height;
    const scale = Math.max(imgW / iw, imgH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = imgX + (imgW - dw) / 2;
    const dy = (imgH - dh) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(imgX, 0, imgW, imgH);
    ctx.clip();
    ctx.drawImage(productImage, dx, dy, dw, dh);
    ctx.restore();

    // Subtle left-edge vignette blending into bg
    const fade = ctx.createLinearGradient(imgX, 0, imgX + 80 * s, 0);
    // Get approximate bg color from gradient — use a dark overlay
    fade.addColorStop(0, 'rgba(10,12,18,1)');
    fade.addColorStop(1, 'rgba(10,12,18,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(imgX, 0, 80 * s, H);
  }

  // ── Top-left: logo or brand name ──────────────────────────────────────────
  const topY = Math.round(52 * s);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (logoImage) {
    // Draw small logo; max height 36px scaled
    const maxLogoH = Math.round(36 * s);
    const logoScale = maxLogoH / logoImage.height;
    const logoW = logoImage.width * logoScale;
    ctx.drawImage(logoImage, px, topY, logoW, maxLogoH);
  } else if (brand) {
    const brandFont = `500 ${Math.round(14 * s)}px ${ff}`;
    ctx.font = brandFont;
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(brand.toUpperCase(), px, topY + 2 * s);
  }

  // ── Badge pill ────────────────────────────────────────────────────────────
  const badgeY = hasProduct ? Math.round(H * 0.28) : Math.round(H * 0.22);
  let afterBadgeY = badgeY;

  if (badge) {
    const badgeFont = `700 ${Math.round(13 * s)}px ${ff}`;
    ctx.font = badgeFont;
    const badgeText = badge;
    const badgeTW = measureTextWidth(badgeText, badgeFont);
    const badgePadX = 14 * s;
    const badgePadY = 6 * s;
    const badgeW = badgeTW + badgePadX * 2;
    const badgeH = Math.round(13 * s) + badgePadY * 2;
    const badgeRadius = badgeH / 2;

    // Pill background
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(px, badgeY, badgeW, badgeH, badgeRadius);
    ctx.fill();

    // Badge text — dark for readability on accent
    ctx.fillStyle = 'rgba(10,12,18,0.92)';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, px + badgePadX, badgeY + badgeH / 2);
    ctx.textBaseline = 'top';

    afterBadgeY = badgeY + badgeH + 20 * s;
  }

  // ── Title (product name) ──────────────────────────────────────────────────
  const { lines: tLines, fontSize: eff } = fitTitleLines(
    title || '',
    ff,
    titleSize,
    800,
    contentW,
    fmt.maxTitleLines,
    s,
  );
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.1 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);

  let yPos = afterBadgeY;
  ctx.fillStyle = '#f8fafc';
  ctx.font = tFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '\u2026';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }

  // ── Price ─────────────────────────────────────────────────────────────────
  if (price) {
    yPos += 18 * s;
    const priceSize = Math.round(titleSize * 1.35 * s);
    const priceFont = `800 ${priceSize}px ${ff}`;
    ctx.font = priceFont;
    ctx.fillStyle = accent;
    ctx.fillText(price, px, yPos);
  }

  // ── Bottom accent bar ─────────────────────────────────────────────────────
  const barH = Math.round(4 * s);
  ctx.fillStyle = accent;
  ctx.fillRect(px, H - Math.round(48 * s), Math.round(48 * s), barH);

  const overflow = tLines.length > fmt.maxTitleLines;
  return {
    titleTotalLines: tLines.length,
    titleVisibleLines: visibleT.length,
    descTotalLines: 0,
    descVisibleLines: 0,
    overflow,
  };
};
