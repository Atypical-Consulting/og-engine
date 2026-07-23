import { describe, expect, it } from 'vitest';
import { renderContactSheet } from '../../scripts/banners/contact-sheet';

describe('renderContactSheet', () => {
  it('emits one img per item and the repo names', () => {
    const html = renderContactSheet([
      { file: 'phmatray__FormCraft.png', name: 'FormCraft', owner: 'phmatray' },
      { file: 'Atypical-Consulting__Koine.png', name: 'Koine', owner: 'Atypical-Consulting' },
    ]);
    expect(html).toContain('<!doctype html>');
    expect((html.match(/<img /g) ?? []).length).toBe(2);
    expect(html).toContain('phmatray__FormCraft.png');
    expect(html).toContain('Koine');
  });
});
