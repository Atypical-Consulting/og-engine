import { measureLines } from '../text-measure';
import { drawBgImage, paintBackgroundMesh, rgba } from './helpers';
import type { TemplateFn } from './types';

export const profileCardTemplate: TemplateFn = (input) => {
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
  const { accent, fontFamily: ff, titleSize, descSize, gradient: gradientSlug } = style;
  const s = Math.max(W, H) / 1200;

  // Resolve fields from variables or content
  const name = variables.name || content.title || '';
  const role = variables.role || '';
  const company = variables.company || content.author || '';
  const bio = variables.bio || content.description || '';

  const avatar = namedImages.avatar ?? null;
  const logo = namedImages.logo ?? null;

  // --- Background ---
  if (bgImage) {
    drawBgImage(ctx, bgImage, W, H, overlayOpacity);
  } else {
    paintBackgroundMesh(ctx, W, H, gradientSlug, accent);
  }

  // Subtle center glow
  const centerGlow = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.48);
  centerGlow.addColorStop(0, rgba(accent, 0.1));
  centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // --- Avatar (large centered circle) ---
  const avatarRadius = Math.round(90 * s);
  const avatarDiameter = avatarRadius * 2;
  const avatarCX = W / 2;
  const avatarTopY = Math.round(62 * s);
  const avatarCY = avatarTopY + avatarRadius;

  if (avatar) {
    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarCX - avatarRadius, avatarCY - avatarRadius, avatarDiameter, avatarDiameter);
    ctx.restore();

    // Accent ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius + Math.round(3 * s), 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.round(3 * s);
    ctx.stroke();
    ctx.restore();
  } else {
    // Placeholder circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = rgba(accent, 0.15);
    ctx.fill();
    ctx.strokeStyle = rgba(accent, 0.5);
    ctx.lineWidth = Math.round(3 * s);
    ctx.stroke();
    ctx.restore();

    // Initials
    const initials = name
      .split(' ')
      .slice(0, 2)
      .map((w: string) => w[0] ?? '')
      .join('')
      .toUpperCase();
    if (initials) {
      const initialsSize = Math.round(60 * s);
      ctx.font = `700 ${initialsSize}px ${ff}`;
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, avatarCX, avatarCY);
    }
  }

  let yPos = avatarTopY + avatarDiameter + Math.round(28 * s);

  // --- Name ---
  if (name) {
    const nameSize = Math.round(titleSize * s);
    const nameFont = `800 ${nameSize}px ${ff}`;
    ctx.font = nameFont;
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(name, W / 2, yPos);
    yPos += Math.round(nameSize * 1.2) + Math.round(8 * s);
  }

  // --- Role + Company ---
  const roleCompanyParts = [role, company].filter(Boolean);
  if (roleCompanyParts.length > 0) {
    const roleFont = `500 ${Math.round(descSize * s)}px ${ff}`;
    ctx.font = roleFont;
    ctx.fillStyle = 'rgba(203,213,225,0.85)';
    ctx.fillText(roleCompanyParts.join(' · '), W / 2, yPos);
    yPos += Math.round(descSize * 1.4 * s) + Math.round(20 * s);
  }

  // --- Bio text ---
  if (bio) {
    const bioSize = Math.round((descSize - 2) * s);
    const bioFont = `400 ${bioSize}px ${ff}`;
    const bioLH = Math.round(bioSize * 1.55);
    const bioW = W * 0.58;
    const bioLines = measureLines(bio, bioFont, bioW);
    const maxBioLines = fmt.maxDescLines;
    const visibleBioLines = bioLines.slice(0, maxBioLines);

    ctx.font = bioFont;
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < visibleBioLines.length; i++) {
      let t = visibleBioLines[i].text;
      if (i === visibleBioLines.length - 1 && bioLines.length > maxBioLines) t += '\u2026';
      ctx.fillText(t, W / 2, yPos);
      yPos += bioLH;
    }
  }

  // --- Logo (bottom-right corner) ---
  if (logo) {
    const maxLogoH = Math.round(36 * s);
    const logoScale = maxLogoH / logo.height;
    const logoW = logo.width * logoScale;
    const logoPad = Math.round(36 * s);
    ctx.drawImage(logo, W - logoPad - logoW, H - logoPad - maxLogoH, logoW, maxLogoH);
  }

  const overflow = false;
  return {
    titleTotalLines: name ? 1 : 0,
    titleVisibleLines: name ? 1 : 0,
    descTotalLines: 0,
    descVisibleLines: 0,
    overflow,
  };
};
