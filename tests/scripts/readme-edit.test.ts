import { describe, expect, it } from 'vitest';
import { ensureBannerInReadme } from '../../scripts/banners/readme-edit';

describe('ensureBannerInReadme', () => {
  it('prepends the banner image line when absent', () => {
    const { content, changed } = ensureBannerInReadme('# FormCraft\n\nText', 'FormCraft');
    expect(changed).toBe(true);
    expect(content.startsWith('![FormCraft banner](.github/banner.png)\n')).toBe(true);
    expect(content).toContain('# FormCraft');
  });

  it('is idempotent when the banner reference already exists', () => {
    const existing = '![FormCraft banner](.github/banner.png)\n\n# FormCraft';
    const { content, changed } = ensureBannerInReadme(existing, 'FormCraft');
    expect(changed).toBe(false);
    expect(content).toBe(existing);
  });

  it('detects an existing reference to the same path regardless of alt text', () => {
    const existing = '![logo](.github/banner.png)\n# X';
    expect(ensureBannerInReadme(existing, 'X').changed).toBe(false);
  });
});
