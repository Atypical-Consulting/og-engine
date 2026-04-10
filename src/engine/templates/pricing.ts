import { measureLines, measureTextWidth } from '../text-measure';
import { drawBgImage, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const pricingTemplate: TemplateFn = (input) => {
  const { ctx, width: W, height: H, content, style, bgImage, overlayOpacity, variables, namedImages } = input;
  const { accent, fontFamily: ff, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  const plan = variables.plan || content.title || '';
  const price = variables.price ?? '';
  const period = variables.period ?? '';
  const featuresRaw = variables.features ?? '';
  const cta = variables.cta ?? '';
  const logo = namedImages.logo ?? null;

  const features = featuresRaw
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  // --- Background ---
  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  // Centered card panel
  const cardW = Math.round(W * 0.52);
  const cardH = Math.round(H * 0.82);
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;
  const cardRadius = Math.round(20 * s);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
  ctx.fillStyle = 'rgba(15,18,28,0.78)';
  ctx.fill();

  // Card border in accent
  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.lineWidth = Math.round(1.5 * s);
  ctx.stroke();
  ctx.restore();

  const innerPad = Math.round(52 * s);
  const contentX = cardX + innerPad;
  const contentW = cardW - innerPad * 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let yPos = cardY + innerPad;

  // --- Logo ---
  if (logo) {
    const maxLogoH = Math.round(38 * s);
    const logoScale = maxLogoH / logo.height;
    const logoW = logo.width * logoScale;
    ctx.drawImage(logo, W / 2 - logoW / 2, yPos, logoW, maxLogoH);
    yPos += maxLogoH + Math.round(20 * s);
  }

  // --- Plan name ---
  if (plan) {
    const planFont = `700 ${Math.round(16 * s)}px ${ff}`;
    ctx.font = planFont;
    ctx.fillStyle = accent;
    ctx.fillText(plan.toUpperCase(), W / 2, yPos);
    yPos += Math.round(16 * 1.4 * s) + Math.round(10 * s);
  }

  // --- Price ---
  if (price) {
    const priceSize = Math.round(80 * s);
    const periodSize = Math.round(26 * s);
    const priceFont = `800 ${priceSize}px ${ff}`;
    const periodFont = `400 ${periodSize}px ${ff}`;

    ctx.font = priceFont;
    const priceW = measureTextWidth(price, priceFont);
    ctx.font = periodFont;
    const periodW = period ? measureTextWidth(period, periodFont) : 0;

    const totalPriceW = priceW + periodW;
    const priceX = W / 2 - totalPriceW / 2;

    // Price value
    ctx.font = priceFont;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(price, priceX, yPos);

    // Period
    if (period) {
      ctx.font = periodFont;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textBaseline = 'bottom';
      ctx.fillText(period, priceX + priceW + Math.round(4 * s), yPos + priceSize);
      ctx.textBaseline = 'top';
    }

    ctx.textAlign = 'center';
    yPos += priceSize + Math.round(24 * s);
  }

  // --- Divider ---
  const divY = yPos;
  ctx.strokeStyle = rgba(accent, 0.25);
  ctx.lineWidth = Math.round(1 * s);
  ctx.beginPath();
  ctx.moveTo(contentX, divY);
  ctx.lineTo(contentX + contentW, divY);
  ctx.stroke();
  yPos += Math.round(20 * s);

  // --- Feature list ---
  const featureFont = `400 ${Math.round(16 * s)}px ${ff}`;
  const featureLH = Math.round(16 * 1.7 * s);
  ctx.font = featureFont;
  ctx.textAlign = 'left';

  const checkW = measureTextWidth('\u2713  ', featureFont);
  for (const feature of features) {
    const featureLines = measureLines(feature, featureFont, contentW - checkW);
    for (let li = 0; li < featureLines.length; li++) {
      if (li === 0) {
        // Checkmark in accent
        ctx.fillStyle = accent;
        ctx.fillText('\u2713', contentX, yPos);
        ctx.fillStyle = 'rgba(226,232,240,0.9)';
        ctx.fillText(featureLines[0].text, contentX + checkW, yPos);
      } else {
        ctx.fillStyle = 'rgba(226,232,240,0.9)';
        ctx.fillText(featureLines[li].text, contentX + checkW, yPos);
      }
      yPos += featureLH;
    }
  }

  // --- CTA button ---
  if (cta) {
    const ctaFont = `700 ${Math.round(17 * s)}px ${ff}`;
    ctx.font = ctaFont;
    const ctaTextW = measureTextWidth(cta, ctaFont);
    const ctaPadX = Math.round(28 * s);
    const ctaPadY = Math.round(13 * s);
    const ctaH = Math.round(17 * s) + ctaPadY * 2;
    const ctaW = ctaTextW + ctaPadX * 2;
    const ctaX = W / 2 - ctaW / 2;
    // Position near card bottom
    const ctaBotY = cardY + cardH - innerPad - ctaH;

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(ctaX, ctaBotY, ctaW, ctaH, ctaH / 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(6,8,12,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cta, W / 2, ctaBotY + ctaH / 2);
  }

  const hasContent = !!(plan || price);
  return {
    titleTotalLines: hasContent ? 1 : 0,
    titleVisibleLines: hasContent ? 1 : 0,
    descTotalLines: 0,
    descVisibleLines: 0,
    overflow: false,
  };
};
