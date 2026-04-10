import { measureTextWidth } from '../text-measure';
import { drawBgImage, fitTitleLines, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const eventTemplate: TemplateFn = (input) => {
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
  const { title, tag } = content;
  const { accent, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  const date = variables.date ?? '';
  const location = variables.location ?? '';
  const speaker = variables.speaker ?? '';

  // --- Background ---
  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, 0);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  // Strong bottom gradient overlay
  const bottomGrad = ctx.createLinearGradient(0, H * 0.15, 0, H);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.45, `rgba(0,0,0,${overlayOpacity * 0.65})`);
  bottomGrad.addColorStop(1, `rgba(0,0,0,${Math.min(0.94, overlayOpacity + 0.22)})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(72 * s);
  const cW = W - px * 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // --- Logo (top-left) ---
  const logo = namedImages.logo ?? namedImages.background ?? null;
  const logoSize = Math.round(56 * s);
  const logoPad = Math.round(44 * s);
  if (logo) {
    const lw = logo.width;
    const lh = logo.height;
    const scale = Math.min(logoSize / lw, logoSize / lh);
    const dw = lw * scale;
    const dh = lh * scale;
    ctx.drawImage(logo, logoPad, logoPad, dw, dh);
  }

  // --- Tag pill (top area) ---
  if (tag) {
    const tagFont = `600 ${Math.round(13 * s)}px ${ff}`;
    ctx.font = tagFont;
    const tagText = tag.toUpperCase();
    const tagW = measureTextWidth(tagText, tagFont);
    const pillPadX = Math.round(16 * s);
    const pillPadY = Math.round(7 * s);
    const pillH = Math.round(13 * s) + pillPadY * 2;
    const pillW = tagW + pillPadX * 2;
    const pillX = logo ? logoPad + logoSize + Math.round(20 * s) : logoPad;
    const pillY = logoPad + (logoSize - pillH) / 2;

    // pill background
    ctx.fillStyle = rgba(accent, 0.18);
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    // pill border
    ctx.strokeStyle = rgba(accent, 0.55);
    ctx.lineWidth = Math.round(1.2 * s);
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.fillText(tagText, pillX + pillPadX, pillY + pillPadY);
  }

  // --- Compute heights for bottom layout ---
  // Info bar: date + location
  const infoFont = `500 ${Math.round(descSize * s)}px ${ff}`;
  const infoLH = Math.round(descSize * 1.4 * s);
  const hasInfo = date || location;

  // Speaker line
  const speakerFont = `400 ${Math.round(14 * s)}px ${ff}`;
  const speakerH = speaker ? Math.round(14 * 1.6 * s) : 0;
  const speakerGap = speaker ? Math.round(18 * s) : 0;

  // Title
  const { lines: tLines, fontSize: eff } = fitTitleLines(title || '', ff, titleSize, 800, cW, fmt.maxTitleLines, s);
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.1 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);

  const infoH = hasInfo ? infoLH : 0;
  const infoGap = hasInfo ? Math.round(20 * s) : 0;
  const titleToInfo = Math.round(22 * s);

  const totalH = visibleT.length * tLH + titleToInfo + infoH + infoGap + speakerGap + speakerH;

  const bottomPad = Math.round(64 * s);
  let yPos = H - bottomPad - totalH;

  // --- Title ---
  ctx.fillStyle = '#ffffff';
  ctx.font = tFont;
  for (let i = 0; i < visibleT.length; i++) {
    let t = visibleT[i].text;
    if (i === visibleT.length - 1 && tLines.length > fmt.maxTitleLines) t += '\u2026';
    ctx.fillText(t, px, yPos);
    yPos += tLH;
  }
  yPos += titleToInfo;

  // --- Info bar: calendar emoji + date, pin emoji + location ---
  if (hasInfo) {
    ctx.font = infoFont;

    let infoX = px;

    if (date) {
      const calLabel = `\uD83D\uDCC5  ${date}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(calLabel, infoX, yPos);
      const calW = measureTextWidth(calLabel, infoFont);
      infoX += calW + Math.round(36 * s);
    }

    if (location) {
      const pinLabel = `\uD83D\uDCCD  ${location}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(pinLabel, infoX, yPos);
    }

    yPos += infoH + infoGap;
  }

  // --- Speaker ---
  if (speaker) {
    ctx.font = speakerFont;
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.fillText('\u2605  ', px, yPos);
    const starW = measureTextWidth('\u2605  ', speakerFont);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(speaker, px + starW, yPos);
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
