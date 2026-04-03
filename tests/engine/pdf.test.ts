import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerFonts } from '../../src/engine/fonts';
import { renderCard } from '../../src/engine/renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

describe('PDF output', () => {
  it('returns a valid PDF buffer', async () => {
    const result = await renderCard({
      title: 'PDF Test',
      description: 'Testing PDF output.',
      author: 'Test',
      tag: 'PDF',
      format: 'og',
      template: 'default',
      accent: '#38ef7d',
      layout: 'left',
      titleSize: 48,
      descSize: 22,
      fontName: 'Outfit',
      gradient: 'void',
      bgImageBuffer: null,
      overlayOpacity: 0.65,
      autoFit: false,
      outputFormat: 'pdf',
      outputQuality: 90,
    });

    expect(result.contentType).toBe('application/pdf');
    expect(result.buffer.length).toBeGreaterThan(0);
    // PDF magic bytes: %PDF
    expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('PDF has valid structure (xref and trailer)', async () => {
    const result = await renderCard({
      title: 'PDF Structure',
      description: '',
      author: '',
      tag: '',
      format: 'og',
      template: 'default',
      accent: '#38ef7d',
      layout: 'left',
      titleSize: 48,
      descSize: 22,
      fontName: 'Outfit',
      gradient: 'void',
      bgImageBuffer: null,
      overlayOpacity: 0.65,
      autoFit: false,
      outputFormat: 'pdf',
      outputQuality: 90,
    });

    const pdfStr = result.buffer.toString('binary');
    expect(pdfStr).toContain('xref');
    expect(pdfStr).toContain('trailer');
    expect(pdfStr).toContain('%%EOF');
  });
});
