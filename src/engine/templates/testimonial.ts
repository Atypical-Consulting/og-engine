import { measureLines } from '../text-measure';
import { paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const testimonialTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, format: fmt, content, style, bgImage, namedImages } = input;
  const { accent, fontFamily: ff, titleSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  // Resolve quote and author fields from variables or content
  const quoteText = input.variables.quote || content.title || '';
  const name = input.variables.name || content.author || '';
  const company = input.variables.company || '';
  const role = input.variables.role || '';

  // Background — gradient mesh, no image typically needed
  if (bgImage) {
    // If somehow a bg image is provided, still use mesh for clean look
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  // Subtle center glow for elegance
  const centerGlow = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.5);
  centerGlow.addColorStop(0, rgba(accent, 0.08));
  centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, W, H);

  const px = Math.round(110 * s);
  const cW = W - px * 2;

  // --- Decorative opening quotation mark ---
  const quoteMarkSize = Math.round(180 * s);
  ctx.font = `700 ${quoteMarkSize}px ${ff}`;
  ctx.fillStyle = rgba(accent, 0.18);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('\u201C', W / 2, Math.round(30 * s));

  // --- Quote text (centered, weight 500, slightly larger) ---
  const quoteSize = Math.round(titleSize * s);
  const quoteFont = `500 ${quoteSize}px ${ff}`;
  const quoteLH = Math.round(quoteSize * 1.45);
  const quoteLines = measureLines(quoteText, quoteFont, cW);
  const maxQuoteLines = fmt.maxTitleLines;
  const visibleQuoteLines = quoteLines.slice(0, maxQuoteLines);

  // --- Attribution row: avatar + name + role + company ---
  const avatarRadius = Math.round(28 * s);
  const avatarDiameter = avatarRadius * 2;
  const attrFont = `600 ${Math.round(17 * s)}px ${ff}`;
  const subFont = `400 ${Math.round(15 * s)}px ${ff}`;
  const attrLH = Math.round(22 * s);
  const subLH = Math.round(20 * s);

  // Measure attribution height
  const hasAvatar = !!namedImages.avatar;
  const hasRoleOrCompany = role || company;
  const attrBlockH = attrLH + (hasRoleOrCompany ? subLH + Math.round(4 * s) : 0);
  const attrBlockWithAvatarH = Math.max(avatarDiameter, attrBlockH);
  const attrGap = Math.round(48 * s);

  // Total content height
  const quoteBlockH = visibleQuoteLines.length * quoteLH;
  const totalH = quoteBlockH + attrGap + attrBlockWithAvatarH;

  // Center vertically (shift slightly above center for breathing room under quote mark)
  const topOffset = Math.round(quoteMarkSize * 0.55 + 20 * s);
  const availableH = H - topOffset - Math.round(px * 0.8);
  let yPos = topOffset + Math.max(0, (availableH - totalH) / 2);

  // --- Draw quote lines ---
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f8fafc';
  ctx.font = quoteFont;
  for (let i = 0; i < visibleQuoteLines.length; i++) {
    let t = visibleQuoteLines[i].text;
    if (i === visibleQuoteLines.length - 1 && quoteLines.length > maxQuoteLines) t += '\u2026';
    ctx.fillText(t, W / 2, yPos);
    yPos += quoteLH;
  }

  yPos += attrGap;

  // --- Attribution row ---
  const avatar = namedImages.avatar ?? null;

  // Measure text widths to calculate total row width for centering
  ctx.font = attrFont;
  const nameWidth = ctx.measureText(name).width;
  ctx.font = subFont;
  const subText = [role, company].filter(Boolean).join(' · ');
  const subWidth = subText ? ctx.measureText(subText).width : 0;
  const textBlockW = Math.max(nameWidth, subWidth);
  const rowWidth = hasAvatar ? avatarDiameter + Math.round(14 * s) + textBlockW : textBlockW;
  const rowStartX = W / 2 - rowWidth / 2;

  // Draw avatar circle
  if (avatar) {
    const cx = rowStartX + avatarRadius;
    const cy = yPos + attrBlockWithAvatarH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, cx - avatarRadius, cy - avatarRadius, avatarDiameter, avatarDiameter);
    ctx.restore();

    // Accent ring around avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, avatarRadius + Math.round(2 * s), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(accent, 0.6);
    ctx.lineWidth = Math.round(2 * s);
    ctx.stroke();
    ctx.restore();
  }

  // Draw name and role/company text
  const textX = hasAvatar ? rowStartX + avatarDiameter + Math.round(14 * s) : W / 2;
  const textAlign: CanvasTextAlign = hasAvatar ? 'left' : 'center';
  const nameY = yPos + (attrBlockWithAvatarH - attrBlockH) / 2;

  ctx.textAlign = textAlign;
  ctx.textBaseline = 'top';

  if (name) {
    ctx.font = attrFont;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, textX, nameY);
  }

  if (subText) {
    ctx.font = subFont;
    ctx.fillStyle = rgba(accent, 0.85);
    ctx.fillText(subText, textX, nameY + attrLH + Math.round(4 * s));
  }

  const overflow = quoteLines.length > maxQuoteLines;
  return {
    titleTotalLines: quoteLines.length,
    titleVisibleLines: visibleQuoteLines.length,
    descTotalLines: 0,
    descVisibleLines: 0,
    overflow,
  };
};
