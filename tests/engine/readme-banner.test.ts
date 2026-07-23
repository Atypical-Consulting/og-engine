import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerFonts } from '../../src/engine/fonts';
import { renderCard } from '../../src/engine/renderer';

beforeAll(async () => {
  await registerFonts(join(process.cwd(), 'fonts'));
});

function baseOptions(overrides = {}) {
  return {
    title: 'FormCraft',
    description: 'Dynamic forms for Blazor — fluent + attribute-based',
    author: '',
    tag: '',
    format: 'readme' as const,
    template: 'readme-banner',
    accent: '#178600',
    layout: 'left' as const,
    titleSize: 64,
    descSize: 26,
    fontName: 'Outfit',
    gradient: 'void',
    bgImageBuffer: null,
    overlayOpacity: 0.65,
    autoFit: false,
    outputFormat: 'png' as const,
    variables: {
      owner: 'phmatray',
      wordmark: 'Philippe Matray',
      language: 'C#',
      stars: '53',
      repoPath: 'github.com/phmatray/FormCraft',
      monoFamily: 'JetBrains Mono',
    },
    namedImages: {},
    outputQuality: 90,
    ...overrides,
  };
}

describe('readme-banner template', () => {
  it('renders a 1280x640 PNG', async () => {
    const res = await renderCard(baseOptions());
    expect(res.width).toBe(1280);
    expect(res.height).toBe(640);
    expect(res.buffer.length).toBeGreaterThan(2000);
  });

  it('flags overflow when the repo name is far too long', async () => {
    const res = await renderCard(
      baseOptions({
        title:
          'This Repository Name Is Absurdly Long And Will Not Fit On Two Lines No Matter What Another Word And More',
      }),
    );
    expect(res.overflow).toBe(true);
  });
});
