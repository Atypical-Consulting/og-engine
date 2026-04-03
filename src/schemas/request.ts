import { z } from 'zod';
import { FORMAT_KEYS } from '../engine/formats';
import { FONTS } from '../engine/fonts';
import { GRADIENTS } from '../engine/gradients';

const formatEnum = z.enum(FORMAT_KEYS as [string, ...string[]]);
const layoutEnum = z.enum(['left', 'center', 'bottom']);
const fontNames = FONTS.map((f) => f.name);
const gradientSlugs = GRADIENTS.map((g) => g.slug);

export const renderSchema = z.object({
  format: formatEnum,
  template: z.string().default('default'),
  title: z.string().min(1, "The 'title' field is required."),
  description: z.string().default(''),
  author: z.string().default(''),
  tag: z.string().default(''),
  style: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Accent must be a 6-digit hex color (e.g. "#38ef7d").').default('#38ef7d'),
    layout: layoutEnum.default('left'),
    font: z.string().refine((v) => fontNames.includes(v), {
      message: `Font must be one of: ${fontNames.join(', ')}`,
    }).default('Outfit'),
    titleSize: z.number().int().min(28).max(72).default(48),
    descSize: z.number().int().min(14).max(32).default(22),
    gradient: z.string().refine((v) => gradientSlugs.includes(v), {
      message: `Gradient must be one of: ${gradientSlugs.join(', ')}`,
    }).default('void'),
    overlayOpacity: z.number().min(0.2).max(0.9).default(0.65),
  }).default({}),
  output: z.object({
    format: z.enum(['png']).default('png'),
    quality: z.number().int().min(1).max(100).default(90),
  }).default({}),
});

export const validateSchema = z.object({
  format: formatEnum,
  title: z.string().min(1, "The 'title' field is required."),
  description: z.string().default(''),
  font: z.string().refine((v) => fontNames.includes(v), {
    message: `Font must be one of: ${fontNames.join(', ')}`,
  }).default('Outfit'),
  titleSize: z.number().int().min(28).max(72).default(48),
  descSize: z.number().int().min(14).max(32).default(22),
  maxTitleLines: z.number().int().min(1).max(10).optional(),
  maxDescLines: z.number().int().min(1).max(10).optional(),
});

export type RenderRequest = z.infer<typeof renderSchema>;
export type ValidateRequest = z.infer<typeof validateSchema>;
