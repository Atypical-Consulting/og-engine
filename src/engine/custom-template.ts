import type { Image, SKRSContext2D } from '@napi-rs/canvas';
import { z } from 'zod';
import { getGradientBySlug } from './gradients';
import type { TemplateResult } from './templates';
import { measureLines } from './text-measure';

/**
 * Custom Template JSON DSL
 *
 * A template definition is an array of layers rendered in order.
 * Each layer has a type and type-specific properties.
 *
 * Variables are interpolated using {{variable}} syntax:
 *   {{title}}, {{description}}, {{author}}, {{tag}}, {{accent}}
 */

// ─── Schema for validation ───────────────────────────────────

const colorSchema = z.string(); // hex, rgba, or variable like "{{accent}}"

const layerBase = z.object({
  type: z.string(),
  x: z.union([z.number(), z.string()]).optional(), // number or "center", "left", "right"
  y: z.union([z.number(), z.string()]).optional(),
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const fillLayer = layerBase.extend({
  type: z.literal('fill'),
  color: colorSchema,
});

const gradientLayer = layerBase.extend({
  type: z.literal('gradient'),
  gradient: z.string(), // gradient slug
});

const rectLayer = layerBase.extend({
  type: z.literal('rect'),
  color: colorSchema,
  radius: z.number().optional(),
});

const textLayer = layerBase.extend({
  type: z.literal('text'),
  content: z.string(), // supports {{title}}, {{description}}, etc.
  font: z.string().optional(),
  fontSize: z.number(),
  fontWeight: z.union([z.number(), z.string()]).default(400),
  color: colorSchema.default('#ffffff'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  maxLines: z.number().int().min(1).max(20).optional(),
  lineHeight: z.number().default(1.2),
  ellipsis: z.boolean().default(true),
});

const imageLayer = layerBase.extend({
  type: z.literal('image'),
  fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
});

const lineLayer = layerBase.extend({
  type: z.literal('line'),
  x2: z.number(),
  y2: z.number(),
  color: colorSchema,
  lineWidth: z.number().default(1),
});

const layerSchema = z.discriminatedUnion('type', [
  fillLayer,
  gradientLayer,
  rectLayer,
  textLayer,
  imageLayer,
  lineLayer,
]);

export const customTemplateSchema = z.object({
  name: z.string().min(1).max(64),
  layers: z.array(layerSchema).min(1).max(50),
});

export type CustomTemplateDefinition = z.infer<typeof customTemplateSchema>;
export type Layer = z.infer<typeof layerSchema>;

// ─── Rendering engine ────────────────────────────────────────

interface RenderContext {
  ctx: SKRSContext2D;
  W: number;
  H: number;
  s: number;
  vars: Record<string, string>;
  fontFamily: string;
  bgImage: Image | null;
}

function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function resolveX(val: number | string | undefined, W: number, elW?: number): number {
  if (val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (val === 'center') return (W - (elW ?? 0)) / 2;
  if (val === 'right') return W - (elW ?? 0);
  return 0;
}

function resolveY(val: number | string | undefined, H: number, elH?: number): number {
  if (val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (val === 'center') return (H - (elH ?? 0)) / 2;
  if (val === 'bottom') return H - (elH ?? 0);
  return 0;
}

function resolveDim(val: number | string | undefined, full: number): number {
  if (val === undefined) return full;
  if (typeof val === 'number') return val;
  if (val === 'full') return full;
  if (typeof val === 'string' && val.endsWith('%')) {
    return (parseFloat(val) / 100) * full;
  }
  return full;
}

export function renderCustomTemplate(
  definition: CustomTemplateDefinition,
  ctx: SKRSContext2D,
  W: number,
  H: number,
  content: { title: string; description: string; author: string; tag: string },
  style: { accent: string; fontFamily: string },
  bgImage: Image | null,
): TemplateResult {
  const s = Math.max(W, H) / 1200;
  const vars: Record<string, string> = {
    title: content.title,
    description: content.description,
    author: content.author,
    tag: content.tag,
    accent: style.accent,
  };

  const rc: RenderContext = { ctx, W, H, s, vars, fontFamily: style.fontFamily, bgImage };

  let titleLines = 0;
  let titleVisible = 0;
  let descLines = 0;
  let descVisible = 0;
  let overflow = false;

  for (const layer of definition.layers) {
    if (layer.opacity !== undefined) {
      ctx.globalAlpha = layer.opacity;
    }

    switch (layer.type) {
      case 'fill': {
        ctx.fillStyle = interpolate(layer.color, vars);
        ctx.fillRect(0, 0, W, H);
        break;
      }

      case 'gradient': {
        const grad = getGradientBySlug(layer.gradient);
        const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
        bg.addColorStop(0, grad.stops[0]);
        bg.addColorStop(1, grad.stops[1]);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        break;
      }

      case 'rect': {
        const w = resolveDim(layer.width, W);
        const h = resolveDim(layer.height, H);
        const x = resolveX(layer.x, W, w);
        const y = resolveY(layer.y, H, h);
        ctx.fillStyle = interpolate(layer.color, vars);
        if (layer.radius) {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, layer.radius);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        break;
      }

      case 'text': {
        const text = interpolate(layer.content, vars);
        if (!text) break;

        const ff = layer.font ?? rc.fontFamily;
        const fontSize = Math.round(layer.fontSize * s);
        const font = `${layer.fontWeight} ${fontSize}px ${ff}`;
        const lh = Math.round(layer.fontSize * layer.lineHeight * s);
        const maxW = resolveDim(layer.width, W);

        const lines = measureLines(text, font, maxW);
        const maxL = layer.maxLines ?? lines.length;
        const visible = lines.slice(0, maxL);

        const x = resolveX(layer.x, W);
        let y = resolveY(layer.y, H);

        ctx.fillStyle = interpolate(layer.color, vars);
        ctx.font = font;
        ctx.textAlign = layer.align;
        ctx.textBaseline = 'top';

        for (let i = 0; i < visible.length; i++) {
          let t = visible[i].text;
          if (layer.ellipsis && i === visible.length - 1 && lines.length > maxL) t += '\u2026';
          const drawX = layer.align === 'center' ? x + maxW / 2 : layer.align === 'right' ? x + maxW : x;
          ctx.fillText(t, drawX, y);
          y += lh;
        }

        // Track title/desc lines
        if (layer.content.includes('{{title}}')) {
          titleLines = lines.length;
          titleVisible = visible.length;
          if (lines.length > maxL) overflow = true;
        }
        if (layer.content.includes('{{description}}')) {
          descLines = lines.length;
          descVisible = visible.length;
          if (lines.length > maxL) overflow = true;
        }

        ctx.textAlign = 'left';
        break;
      }

      case 'image': {
        if (!rc.bgImage) break;
        const w = resolveDim(layer.width, W);
        const h = resolveDim(layer.height, H);
        const x = resolveX(layer.x, W, w);
        const y = resolveY(layer.y, H, h);

        if (layer.fit === 'cover') {
          const imgW = rc.bgImage.width;
          const imgH = rc.bgImage.height;
          const scale = Math.max(w / imgW, h / imgH);
          const dw = imgW * scale;
          const dh = imgH * scale;
          const dx = x + (w - dw) / 2;
          const dy = y + (h - dh) / 2;
          ctx.drawImage(rc.bgImage, dx, dy, dw, dh);
        } else if (layer.fit === 'contain') {
          const imgW = rc.bgImage.width;
          const imgH = rc.bgImage.height;
          const scale = Math.min(w / imgW, h / imgH);
          const dw = imgW * scale;
          const dh = imgH * scale;
          const dx = x + (w - dw) / 2;
          const dy = y + (h - dh) / 2;
          ctx.drawImage(rc.bgImage, dx, dy, dw, dh);
        } else {
          ctx.drawImage(rc.bgImage, x, y, w, h);
        }
        break;
      }

      case 'line': {
        ctx.strokeStyle = interpolate(layer.color, vars);
        ctx.lineWidth = layer.lineWidth;
        const x = resolveX(layer.x, W);
        const y = resolveY(layer.y, H);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(layer.x2, layer.y2);
        ctx.stroke();
        break;
      }
    }

    ctx.globalAlpha = 1;
  }

  return {
    titleTotalLines: titleLines,
    titleVisibleLines: titleVisible,
    descTotalLines: descLines,
    descVisibleLines: descVisible,
    overflow,
  };
}
