import { measureTextWidth } from '../text-measure';
import { drawBgImage, fitTitleLines, paintBackgroundMesh } from './helpers';
import type { TemplateFn } from './types';

export const newsArticleTemplate: TemplateFn = (input) => {
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

  const source = variables.source ?? '';
  const date = variables.date ?? '';
  const category = variables.category ?? tag ?? '';
  const logo = namedImages.logo ?? null;

  // --- Background ---
  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  // Strong bottom gradient for text legibility
  const bottomGrad = ctx.createLinearGradient(0, H * 0.25, 0, H);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.4, `rgba(0,0,0,${overlayOpacity * 0.7})`);
  bottomGrad.addColorStop(1, `rgba(0,0,0,${Math.min(0.96, overlayOpacity + 0.28)})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(72 * s);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // --- Logo (top-left) ---
  const logoSize = Math.round(48 * s);
  const logoPad = Math.round(44 * s);
  if (logo) {
    const lw = logo.width;
    const lh = logo.height;
    const scale = Math.min(logoSize / lw, logoSize / lh);
    const dw = lw * scale;
    const dh = lh * scale;
    ctx.drawImage(logo, logoPad, logoPad, dw, dh);
  }

  // --- Category pill (top area, accent) ---
  if (category) {
    const catFont = `700 ${Math.round(13 * s)}px ${ff}`;
    ctx.font = catFont;
    const catText = category.toUpperCase();
    const catW = measureTextWidth(catText, catFont);
    const pillPadX = Math.round(16 * s);
    const pillPadY = Math.round(7 * s);
    const pillH = Math.round(13 * s) + pillPadY * 2;
    const pillW = catW + pillPadX * 2;
    const pillX = logo ? logoPad + logoSize + Math.round(20 * s) : logoPad;
    const pillY = logoPad + (logoSize - pillH) / 2;

    // Solid accent pill
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(6,8,12,0.92)';
    ctx.fillText(catText, pillX + pillPadX, pillY + pillPadY);
  }

  // --- Bottom layout: title + source/date bar ---
  const metaFont = `500 ${Math.round(descSize * s)}px ${ff}`;
  const metaH = Math.round(descSize * 1.4 * s);
  const hasMeta = source || date;

  const { lines: tLines, fontSize: eff } = fitTitleLines(
    title || '',
    ff,
    titleSize,
    800,
    W - px * 2,
    fmt.maxTitleLines,
    s,
  );
  const tFont = `800 ${Math.round(eff * s)}px ${ff}`;
  const tLH = Math.round(eff * 1.1 * s);
  const visibleT = tLines.slice(0, fmt.maxTitleLines);

  const metaGap = hasMeta ? Math.round(20 * s) : 0;
  const totalH = visibleT.length * tLH + metaGap + (hasMeta ? metaH : 0);
  const bottomPad = Math.round(56 * s);

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

  yPos += metaGap;

  // --- Source + date bar ---
  if (hasMeta) {
    ctx.font = metaFont;
    let metaX = px;

    if (source) {
      ctx.fillStyle = accent;
      ctx.fillText(source, metaX, yPos);
      metaX += measureTextWidth(source, metaFont) + Math.round(24 * s);
    }

    if (source && date) {
      // Separator dot
      const sepFont = `400 ${Math.round(descSize * s)}px ${ff}`;
      ctx.font = sepFont;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('\u00B7', metaX, yPos);
      metaX += measureTextWidth('\u00B7  ', sepFont);
      ctx.font = metaFont;
    }

    if (date) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(date, metaX, yPos);
    }
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
