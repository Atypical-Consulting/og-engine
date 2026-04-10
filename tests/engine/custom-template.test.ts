import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { customTemplateSchema, renderCustomTemplate } from '../../src/engine/custom-template';
import { registerFonts } from '../../src/engine/fonts';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

function parseDef(raw: unknown) {
  return customTemplateSchema.parse(raw);
}

describe('customTemplateSchema', () => {
  it('validates a simple template', () => {
    const result = customTemplateSchema.safeParse({
      name: 'my-template',
      layers: [
        { type: 'fill', color: '#000000' },
        { type: 'text', content: '{{title}}', fontSize: 48, x: 64, y: 100, width: 1072 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty layers', () => {
    const result = customTemplateSchema.safeParse({
      name: 'empty',
      layers: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown layer type', () => {
    const result = customTemplateSchema.safeParse({
      name: 'bad',
      layers: [{ type: 'unknown' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('renderCustomTemplate', () => {
  it('renders a simple template with fill + text', () => {
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    const def = parseDef({
      name: 'test',
      layers: [
        { type: 'fill', color: '#1a1a2e' },
        {
          type: 'text',
          content: '{{title}}',
          fontSize: 48,
          fontWeight: 800,
          x: 64,
          y: 100,
          width: 1072,
          maxLines: 3,
          color: '#ffffff',
        },
      ],
    });

    const result = renderCustomTemplate(
      def,
      ctx,
      1200,
      630,
      { title: 'Hello Custom', description: '', author: '', tag: '' },
      { accent: '#38ef7d', fontFamily: 'Outfit' },
      null,
      {},
    );

    expect(result.titleTotalLines).toBeGreaterThan(0);
    expect(result.titleVisibleLines).toBeGreaterThan(0);
  });

  it('interpolates variables', () => {
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    const def = parseDef({
      name: 'vars',
      layers: [
        { type: 'fill', color: '{{accent}}' },
        { type: 'text', content: 'By {{author}}', fontSize: 20, x: 64, y: 500, width: 1072, color: '#ffffff' },
      ],
    });

    const result = renderCustomTemplate(
      def,
      ctx,
      1200,
      630,
      { title: 'Title', description: 'Desc', author: 'Claude', tag: 'AI' },
      { accent: '#ff0000', fontFamily: 'Outfit' },
      null,
      {},
    );

    expect(result).toBeDefined();
  });

  it('renders gradient and rect layers', () => {
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    const def = parseDef({
      name: 'multi',
      layers: [
        { type: 'gradient', gradient: 'void' },
        { type: 'rect', color: '#38ef7d', x: 64, y: 500, width: 100, height: 4, radius: 2 },
        {
          type: 'text',
          content: '{{title}}',
          fontSize: 48,
          fontWeight: 800,
          x: 64,
          y: 100,
          width: 1072,
          color: '#ffffff',
        },
      ],
    });

    const result = renderCustomTemplate(
      def,
      ctx,
      1200,
      630,
      { title: 'Multi Layer', description: '', author: '', tag: '' },
      { accent: '#38ef7d', fontFamily: 'Outfit' },
      null,
      {},
    );

    expect(result.titleVisibleLines).toBeGreaterThan(0);
  });
});

describe('renderCustomTemplate with named images', () => {
  it('renders image layer with source referencing a named image (graceful skip when missing)', () => {
    // Test that the template renders without error when named images is empty
    // and source references a missing image (should skip gracefully).
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    const def = parseDef({
      name: 'test-named-img',
      layers: [
        { type: 'fill', color: '#000000' },
        { type: 'image', source: 'logo', x: 50, y: 50, width: 200, height: 200 },
        {
          type: 'text',
          content: '{{title}}',
          fontSize: 48,
          x: 100,
          y: 300,
          width: 1000,
          color: '#ffffff',
        },
      ],
    });

    const result = renderCustomTemplate(
      def,
      ctx,
      1200,
      630,
      { title: 'Test', description: '', author: '', tag: '' },
      { accent: '#38ef7d', fontFamily: 'Outfit' },
      null,
      {}, // empty named images — logo should be skipped gracefully
    );

    expect(result.overflow).toBe(false);
  });
});
