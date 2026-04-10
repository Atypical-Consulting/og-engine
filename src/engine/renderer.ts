import { createCanvas, type Image, loadImage } from '@napi-rs/canvas';
import { autoFitCard } from './autofit';
import { type CustomTemplateDefinition, renderCustomTemplate } from './custom-template';
import { getFontByName } from './fonts';
import { FORMATS, type FormatKey } from './formats';
import { buildPdf } from './pdf';
import { getTemplate } from './templates';

export interface RenderOptions {
  title: string;
  description: string;
  author: string;
  tag: string;
  format: FormatKey;
  template: string;
  accent: string;
  layout: 'left' | 'center' | 'bottom';
  titleSize: number;
  descSize: number;
  fontName: string;
  gradient: string;
  bgImageBuffer: Buffer | null;
  overlayOpacity: number;
  autoFit: boolean;
  customTemplateDefinition?: CustomTemplateDefinition;
  outputFormat: 'png' | 'webp' | 'pdf';
  variables?: Record<string, string>;
  namedImages?: Record<string, import('@napi-rs/canvas').Image | null>;
  outputQuality: number;
  timing?: boolean;
}

export interface RenderPhases {
  textMeasureMs: number;
  canvasDrawMs: number;
  pngEncodeMs: number;
  totalMs: number;
}

export interface RenderResult {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  titleTotalLines: number;
  titleVisibleLines: number;
  descTotalLines: number;
  descVisibleLines: number;
  overflow: boolean;
  phases?: RenderPhases;
}

export async function renderCard(options: RenderOptions): Promise<RenderResult> {
  const {
    title,
    description,
    author,
    tag,
    format,
    template,
    accent,
    layout,
    fontName,
    gradient: gradientSlug,
    bgImageBuffer,
    overlayOpacity,
    autoFit,
    outputFormat,
    outputQuality,
    timing,
  } = options;

  // Auto-fit font sizes if requested
  let { titleSize, descSize } = options;
  if (autoFit) {
    const fitted = autoFitCard({ title, description, format, fontName });
    titleSize = fitted.titleSize;
    descSize = fitted.descSize;
  }

  const fmt = FORMATS[format];
  if (!fmt) throw new Error(`Unknown format: ${format}`);

  const W = fmt.w;
  const H = fmt.h;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fontEntry = getFontByName(fontName);
  const t = timing ? { t0: performance.now(), t1: 0, t2: 0, t3: 0 } : null;

  // Load background image if provided
  let bgImage: Image | null = null;
  if (bgImageBuffer) {
    bgImage = await loadImage(bgImageBuffer);
  }

  if (t) t.t1 = performance.now();

  const variables: Record<string, string> = {
    title,
    description,
    author,
    tag,
    ...options.variables,
  };

  // Run template — custom DSL or built-in
  let result: import('./templates').TemplateResult;
  if (options.customTemplateDefinition) {
    result = renderCustomTemplate(
      options.customTemplateDefinition,
      ctx,
      W,
      H,
      variables,
      { accent, fontFamily: fontEntry.family },
      bgImage,
      options.namedImages ?? {},
    );
  } else {
    const templateFn = getTemplate(template);
    result = templateFn({
      canvas,
      ctx,
      width: W,
      height: H,
      format: fmt,
      content: { title, description, author, tag },
      style: {
        accent,
        layout,
        fontFamily: fontEntry.family,
        titleSize,
        descSize,
        gradient: gradientSlug,
      },
      bgImage,
      overlayOpacity,
      variables,
      namedImages: options.namedImages ?? {},
    });
  }

  if (t) t.t2 = performance.now();

  // Encode output
  let buffer: Buffer;
  let contentType: string;

  if (outputFormat === 'pdf') {
    const pngBuffer = canvas.toBuffer('image/png');
    buffer = buildPdf(pngBuffer, W, H);
    contentType = 'application/pdf';
  } else if (outputFormat === 'webp') {
    buffer = canvas.toBuffer('image/webp', outputQuality);
    contentType = 'image/webp';
  } else {
    buffer = canvas.toBuffer('image/png');
    contentType = 'image/png';
  }

  let phases: RenderPhases | undefined;
  if (t) {
    t.t3 = performance.now();
    phases = {
      textMeasureMs: Number((t.t1 - t.t0).toFixed(3)),
      canvasDrawMs: Number((t.t2 - t.t1).toFixed(3)),
      pngEncodeMs: Number((t.t3 - t.t2).toFixed(3)),
      totalMs: Number((t.t3 - t.t0).toFixed(3)),
    };
  }

  return {
    buffer,
    contentType,
    width: W,
    height: H,
    ...result,
    phases,
  };
}
