import { measureTextWidth } from '../text-measure';
import { drawBgImage, fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const announcementTemplate: TemplateFn = (input) => {
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
  const { title: contentTitle, tag: contentTag } = content;
  const { accent, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  const title = contentTitle || '';
  const subtitle = variables.subtitle ?? content.description ?? '';
  const cta = variables.cta ?? '';
  const tag = variables.tag ?? contentTag ?? '';
  const logo = namedImages.logo ?? null;

  // --- Background ---
  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, Math.max(overlayOpacity, 0.62));
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  // Heavy dramatic overlay for high-contrast feel
  const dramaticOverlay = ctx.createLinearGradient(0, 0, 0, H);
  dramaticOverlay.addColorStop(0, 'rgba(4,6,12,0.38)');
  dramaticOverlay.addColorStop(0.5, 'rgba(4,6,12,0.18)');
  dramaticOverlay.addColorStop(1, 'rgba(4,6,12,0.55)');
  ctx.fillStyle = dramaticOverlay;
  ctx.fillRect(0, 0, W, H);

  // Accent glow in center
  const glow = ctx.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, W * 0.55);
  glow.addColorStop(0, rgba(accent, 0.18));
  glow.addColorStop(0.6, rgba(accent, 0.06));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(80 * s);
  const cW = W - px * 2;

  ctx.textBaseline = 'top';

  // --- Logo (top-left) ---
  if (logo) {
    const maxLogoH = Math.round(40 * s);
    const logoScale = maxLogoH / logo.height;
    const logoW = logo.width * logoScale;
    const logoPad = Math.round(44 * s);
    ctx.drawImage(logo, logoPad, logoPad, logoW, maxLogoH);
  }

  // --- Tag pill (top, centered) ---
  if (tag) {
    const tagFont = `700 ${Math.round(13 * s)}px ${ff}`;
    ctx.font = tagFont;
    const tagText = tag.toUpperCase();
    const tagW = measureTextWidth(tagText, tagFont);
    const pillPadX = Math.round(18 * s);
    const pillPadY = Math.round(8 * s);
    const pillH = Math.round(13 * s) + pillPadY * 2;
    const pillW = tagW + pillPadX * 2;
    const pillX = W / 2 - pillW / 2;
    const pillY = Math.round(48 * s);

    // Pill with accent border and translucent bg
    ctx.fillStyle = rgba(accent, 0.18);
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.round(1.5 * s);
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.fillText(tagText, pillX + pillPadX, pillY + pillPadY);
  }

  // --- Center area: title + subtitle ---
  const { lines: tLines, fontSize: eff } = fitTitleLines(
    title,
    ff,
    Math.round(titleSize * 1.1),
    900,
    cW,
    fmt.maxTitleLines,
    s,
  );
  const tFont = `900 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.06 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);

  const subFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const subLH = Math.round(descSize * 1.5 * s);
  const hasSubtitle = !!subtitle;
  const subGap = hasSubtitle ? Math.round(18 * s) : 0;

  const totalTextH = visibleT.length * tLH + subGap + (hasSubtitle ? subLH : 0);
  const textStartY = (H - totalTextH) / 2;
  let yPos = textStartY;

  // Title — centered, bold, white
  ctx.font = tFont;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '\u2026';
    ctx.fillText(t, W / 2, yPos);
    yPos += tLH;
  }

  // Subtitle
  if (hasSubtitle) {
    yPos += subGap;
    ctx.font = subFont;
    ctx.fillStyle = 'rgba(203,213,225,0.82)';
    ctx.fillText(subtitle, W / 2, yPos);
  }

  // --- CTA button (bottom-center) ---
  if (cta) {
    const ctaFont = `700 ${Math.round(18 * s)}px ${ff}`;
    ctx.font = ctaFont;
    const ctaTextW = measureTextWidth(cta, ctaFont);
    const ctaPadX = Math.round(36 * s);
    const ctaPadY = Math.round(14 * s);
    const ctaH = Math.round(18 * s) + ctaPadY * 2;
    const ctaW = ctaTextW + ctaPadX * 2;
    const ctaX = W / 2 - ctaW / 2;
    const ctaY = H - Math.round(72 * s) - ctaH;

    // Accent filled button
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(ctaX, ctaY, ctaW, ctaH, ctaH / 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(6,8,12,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cta, W / 2, ctaY + ctaH / 2);
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
