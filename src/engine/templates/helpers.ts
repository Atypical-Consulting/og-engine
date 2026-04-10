import type { Image, SKRSContext2D } from '@napi-rs/canvas';
import { getGradientBySlug } from '../gradients';
import { measureLines } from '../text-measure';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const i = Number.parseInt(n, 16);
  return [(i >> 16) & 255, (i >> 8) & 255, i & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function paintBackgroundMesh(ctx: SKRSContext2D, W: number, H: number, gradientSlug: string, accent: string) {
  const grad = getGradientBySlug(gradientSlug);
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, grad.stops[0]);
  base.addColorStop(1, grad.stops[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const g1 = ctx.createRadialGradient(W * 0.2, H * 0.18, 0, W * 0.2, H * 0.18, Math.max(W, H) * 0.6);
  g1.addColorStop(0, rgba(accent, 0.22));
  g1.addColorStop(0.5, rgba(accent, 0.06));
  g1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(W * 0.88, H * 0.95, 0, W * 0.88, H * 0.95, W * 0.55);
  g2.addColorStop(0, rgba(accent, 0.1));
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
}

export function drawBgImage(ctx: SKRSContext2D, img: Image, W: number, H: number, opacity: number) {
  const iw = img.width;
  const ih = img.height;
  const scale = Math.max(W / iw, H / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.fillStyle = `rgba(6,8,12,${opacity})`;
  ctx.fillRect(0, 0, W, H);
}

export function fitTitleLines(
  text: string,
  family: string,
  baseSize: number,
  weight: number,
  cW: number,
  maxLines: number,
  scale: number,
): { lines: ReturnType<typeof measureLines>; fontSize: number } {
  let size = baseSize;
  const min = Math.max(20, Math.round(baseSize * 0.7));
  while (size > min) {
    const font = `${weight} ${Math.round(size * scale)}px ${family}`;
    const lines = measureLines(text, font, cW);
    if (lines.length <= maxLines) return { lines, fontSize: size };
    size -= 2;
  }
  const font = `${weight} ${Math.round(size * scale)}px ${family}`;
  return { lines: measureLines(text, font, cW), fontSize: size };
}
