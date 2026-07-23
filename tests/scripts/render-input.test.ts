import { describe, expect, it } from 'vitest';
import { buildBannerRenderOptions, formatStars } from '../../scripts/banners/render-input';

const base = {
  owner: 'phmatray',
  name: 'FormCraft',
  description: 'gh description',
  language: 'C#',
  stars: 53,
  tagline: 'Dynamic forms for Blazor',
  override: null,
};

describe('buildBannerRenderOptions', () => {
  it('maps owner to wordmark, language to accent, and fills variables', () => {
    const o = buildBannerRenderOptions(base);
    expect(o.template).toBe('readme-banner');
    expect(o.format).toBe('readme');
    expect(o.accent).toBe('#178600');
    expect(o.description).toBe('Dynamic forms for Blazor');
    expect(o.variables?.wordmark).toBe('Philippe Matray');
    expect(o.variables?.repoPath).toBe('github.com/phmatray/FormCraft');
    expect(o.variables?.stars).toBe('53');
  });

  it('uses the Atypical wordmark for the org owner', () => {
    const o = buildBannerRenderOptions({ ...base, owner: 'Atypical-Consulting' });
    expect(o.variables?.wordmark).toBe('Atypical Consulting');
  });

  it('applies overrides (tagline, accent, emoji, wordmark) with precedence', () => {
    const o = buildBannerRenderOptions({
      ...base,
      override: { tagline: 'Custom pitch', accent: '#8844AE', emoji: '🎨', wordmark: 'PM' },
    });
    expect(o.description).toBe('Custom pitch');
    expect(o.accent).toBe('#8844AE');
    expect(o.title).toBe('🎨 FormCraft');
    expect(o.variables?.wordmark).toBe('PM');
  });

  it('falls back tagline -> description -> empty', () => {
    expect(buildBannerRenderOptions({ ...base, tagline: null }).description).toBe('gh description');
    expect(buildBannerRenderOptions({ ...base, tagline: null, description: null }).description).toBe('');
  });
});

describe('formatStars', () => {
  it('formats thousands compactly', () => {
    expect(formatStars(53)).toBe('53');
    expect(formatStars(1650)).toBe('1.7k');
  });
});
